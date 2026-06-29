/**
 * Match engine — orchestrates the full 90-minute match lifecycle.
 *
 * Drives the clock (90 match minutes ≈ 30 real minutes = 1 match minute
 * per 20 seconds), opens decision windows on schedule, triggers the
 * simulator after each window closes, updates scores from simulation
 * events, and broadcasts everything over SSE.
 *
 * One engine instance per session. Started when a match is kicked off
 * via POST /api/match/start.
 */
import type { Session } from './types'
import { persistSession } from './session-store'
import { broadcast } from './sse'
import { openDecisionWindow } from './decision-lifecycle'
import { appendProvenance } from './provenance'
import {
  WINDOW_MATCH_MINUTES,
  windowTypeForIndex,
  buildDecisionWindow,
  WINDOW_OPEN_DURATION_MS,
} from './window-catalog'
import { simulateMatchSegment } from './match-simulator'

const MS_PER_MATCH_MINUTE = 20_000 // 90 min / 30 real min = 20s per match minute
const HALF_TIME_PAUSE_MS = 15_000  // 15s real-time half-time break

const engines = new Map<string, MatchEngine>()

export function getEngine(sessionId: string): MatchEngine | undefined {
  return engines.get(sessionId)
}

export function startEngine(session: Session): MatchEngine {
  const existing = engines.get(session.id)
  if (existing) return existing
  const engine = new MatchEngine(session)
  engines.set(session.id, engine)
  engine.start()
  return engine
}

export function stopEngine(sessionId: string): void {
  const engine = engines.get(sessionId)
  if (engine) {
    engine.stop()
    engines.delete(sessionId)
  }
}

class MatchEngine {
  private session: Session
  private clockTimer: ReturnType<typeof setTimeout> | null = null
  private windowIndex = 0
  private lastSimulatedMinute = 0
  private running = false

  constructor(session: Session) {
    this.session = session
  }

  start(): void {
    if (this.running) return
    this.running = true
    const ms = this.session.matchState
    ms.status = 'first-half'
    ms.minute = 0

    appendProvenance(this.session, {
      category: 'session',
      title: 'Match kicked off',
      detail: 'The live clock started and the first simulation segment was queued.',
      data: {
        status: ms.status,
        minute: ms.minute,
      },
    })

    broadcast(this.session, {
      kind: 'match-started',
      matchState: ms,
      serverTime: Date.now(),
    })

    console.log(`[engine] Match started for session ${this.session.id}`)

    // Run initial simulation for opening minutes (1-9)
    persistSession(this.session)
    void this.runSimulation(1, 9)

    // Start the clock
    this.scheduleTick()
  }

  stop(): void {
    this.running = false
    if (this.clockTimer) {
      clearTimeout(this.clockTimer)
      this.clockTimer = null
    }
  }

  private scheduleTick(): void {
    if (!this.running) return
    this.clockTimer = setTimeout(() => this.tick(), MS_PER_MATCH_MINUTE)
  }

  private tick(): void {
    if (!this.running) return
    const ms = this.session.matchState
    ms.minute++

    // Status transitions
    if (ms.minute === 45 && ms.status === 'first-half') {
      ms.status = 'half-time'
      appendProvenance(this.session, {
        category: 'session',
        title: 'Half-time reached',
        detail: 'The match entered the half-time pause.',
        data: {
          score: `${ms.homeTeam.score}-${ms.awayTeam.score}`,
        },
      })
      persistSession(this.session)
      broadcast(this.session, {
        kind: 'status-change',
        status: 'half-time',
        minute: 45,
        matchState: ms,
        serverTime: Date.now(),
      })
      // Pause for half-time, then resume into second half
      this.clockTimer = setTimeout(() => {
        ms.status = 'second-half'
        appendProvenance(this.session, {
          category: 'session',
          title: 'Second half started',
          detail: 'The match resumed after half-time.',
          data: {
            score: `${ms.homeTeam.score}-${ms.awayTeam.score}`,
          },
        })
        persistSession(this.session)
        broadcast(this.session, {
          kind: 'status-change',
          status: 'second-half',
          minute: 45,
          matchState: ms,
          serverTime: Date.now(),
        })
        this.scheduleTick()
      }, HALF_TIME_PAUSE_MS)
      return
    }

    if (ms.minute >= 90) {
      ms.minute = 90
      ms.status = 'full-time'
      persistSession(this.session)
      // Final simulation for closing stretch
      void this.runSimulation(
        this.lastSimulatedMinute + 1,
        90,
      ).then(() => {
        appendProvenance(this.session, {
          category: 'result',
          title: 'Final result recorded',
          detail: `${ms.homeTeam.name} ${ms.homeTeam.score}-${ms.awayTeam.score} ${ms.awayTeam.name}.`,
          data: {
            homeScore: ms.homeTeam.score,
            awayScore: ms.awayTeam.score,
            totalEarned: ms.totalEarned,
          },
        })
        broadcast(this.session, {
          kind: 'status-change',
          status: 'full-time',
          minute: 90,
          matchState: ms,
          serverTime: Date.now(),
        })
        console.log(
          `[engine] Full-time: ${ms.homeTeam.name} ${ms.homeTeam.score} - ${ms.awayTeam.score} ${ms.awayTeam.name}`,
        )
        this.stop()
      })
      return
    }

    // Broadcast clock tick
    broadcast(this.session, {
      kind: 'clock-tick',
      minute: ms.minute,
      status: ms.status,
      serverTime: Date.now(),
    })
    persistSession(this.session)

    // Check if we should open a decision window at this minute
    const windowMinutes = WINDOW_MATCH_MINUTES as readonly number[]
    if (
      windowMinutes.includes(ms.minute) &&
      this.windowIndex < WINDOW_MATCH_MINUTES.length
    ) {
      const type = windowTypeForIndex(this.windowIndex)
      const window = buildDecisionWindow(type, Date.now())
      openDecisionWindow(this.session, window)
      const currentWindowIndex = this.windowIndex
      this.windowIndex++

      // After window closes, run simulation for the stretch to the next window
      const nextWindowMinute =
        currentWindowIndex + 1 < WINDOW_MATCH_MINUTES.length
          ? WINDOW_MATCH_MINUTES[currentWindowIndex + 1]
          : ms.minute + 15
      const simFrom = ms.minute
      const simTo = Math.min(nextWindowMinute, 90)

      // Wait for window close + manager speech, then simulate
      setTimeout(() => {
        void this.runSimulation(simFrom, simTo)
      }, WINDOW_OPEN_DURATION_MS + 5_000) // +5s buffer for manager speech API call
    }

    this.scheduleTick()
  }

  private async runSimulation(
    fromMinute: number,
    toMinute: number,
  ): Promise<void> {
    if (!this.running && this.session.matchState.status !== 'full-time') return
    if (fromMinute >= toMinute) return

    try {
      console.log(`[engine] Simulating minutes ${fromMinute}-${toMinute}`)
      const result = await simulateMatchSegment({
        matchState: this.session.matchState,
        fromMinute,
        toMinute,
      })

      const ms = this.session.matchState
      for (const event of result.events) {
        ms.events.push(event)

        // Update scores from simulation events
        if (event.type === 'goal') {
          ms.homeTeam.score++
        } else if (event.type === 'goal-conceded') {
          ms.awayTeam.score++
        }
      }

      this.lastSimulatedMinute = toMinute

      appendProvenance(this.session, {
        category: 'simulation',
        title: 'Match segment simulated',
        detail: `Claude simulated minutes ${fromMinute}-${toMinute} and returned ${result.events.length} events.`,
        data: {
          fromMinute,
          toMinute,
          model: result.model,
          latencyMs: result.latencyMs,
          eventIds: result.events.map((event) => event.id),
        },
      })
      persistSession(this.session)

      broadcast(this.session, {
        kind: 'simulation',
        fromMinute,
        toMinute,
        events: result.events,
        matchState: ms,
        model: result.model,
        latencyMs: result.latencyMs,
        serverTime: Date.now(),
      })

      console.log(
        `[engine] Simulation ${fromMinute}-${toMinute}: ${result.events.length} events, score ${ms.homeTeam.score}-${ms.awayTeam.score}`,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[engine] Simulation failed (${fromMinute}-${toMinute}):`, message)
      broadcast(this.session, {
        kind: 'simulation-error',
        fromMinute,
        toMinute,
        error: message,
        serverTime: Date.now(),
      })
    }
  }
}
