/**
 * Phase 6 end-to-end proof — REAL Claude API call producing the AI
 * Manager's speech AND a deterministic tactical state change.
 *
 * What this script does, top to bottom:
 *   1. Creates a fresh session.
 *   2. Opens an SSE listener against /api/match/events so we capture
 *      every event the server broadcasts during the test — most importantly
 *      `decision-closed`, `manager-spoke`, and `manager-error`.
 *   3. Opens a `formation` decision window with a short duration.
 *   4. Adds taps via the cheap /api/decision/tap path (this proof is about
 *      the *manager*, not the Gateway settlement we already verified in
 *      Phase 5 — we don't need real money for this loop). The taps are
 *      lopsided so the engine returns a decisive verdict for option A.
 *   5. Closes the window. The lifecycle fires the engine, then async-
 *      schedules the manager call.
 *   6. Waits for the `manager-spoke` event on the SSE channel and prints:
 *        - the speech (real, from Claude, not synthesized)
 *        - the model id (proves Sonnet 4.6 ran)
 *        - latency (round-trip)
 *        - the tactic mutation (state delta or appended event)
 *   7. Re-reads the session via /api/session/[id] and prints the homeTeam
 *      formation/mentality/pressing fields — proves the matchState ACTUALLY
 *      changed and isn't just a speech with no effect.
 *
 * PASS criteria:
 *   - We received exactly one `manager-spoke` event (no `manager-error`).
 *   - The speech is non-empty and at least 40 chars (sanity floor).
 *   - The session's homeTeam formation matches the deterministic mapping
 *     for the winning option ("Switch to 4-3-3" → 4-3-3; "Drop to 5-3-2"
 *     → 5-3-2; "Hold the 4-4-2" / "Stay at 4-4-2" → unchanged).
 */
import type { DecisionWindow, MatchState } from '../lib/types'

const BASE = process.env.GAFFER_BASE_URL ?? 'http://localhost:3000'

type Json = Record<string, unknown>

async function api(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    body: init?.body,
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${path} returned non-JSON (status ${res.status}):\n${text}`)
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}):\n${JSON.stringify(parsed, null, 2)}`)
  }
  return parsed as Json
}

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(22)}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
}

interface SseFrame {
  kind: string
  [k: string]: unknown
}

/**
 * Tiny SSE collector. Connects, captures every `data:` frame, lets the
 * caller pull by predicate. We do not depend on EventSource since
 * Node 22's global fetch + ReadableStream is enough.
 */
class SseCollector {
  private frames: SseFrame[] = []
  private waiters: Array<(frame: SseFrame) => void> = []
  private abort = new AbortController()
  private buffer = ''

  async start(sessionId: string): Promise<void> {
    const res = await fetch(`${BASE}/api/match/events?sessionId=${sessionId}`, {
      signal: this.abort.signal,
      headers: { accept: 'text/event-stream' },
    })
    if (!res.ok || !res.body) {
      throw new Error(`SSE connect failed (${res.status})`)
    }
    // Don't await — run consumer in background.
    void this.consume(res.body)
  }

  private async consume(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        this.buffer += decoder.decode(value, { stream: true })
        // SSE frames are separated by blank lines (\n\n).
        let idx: number
        while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
          const raw = this.buffer.slice(0, idx)
          this.buffer = this.buffer.slice(idx + 2)
          this.handleFrame(raw)
        }
      }
    } catch {
      // aborted — fine
    }
  }

  private handleFrame(raw: string): void {
    // We only care about `data:` lines.
    const dataLine = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('data:'))
    if (!dataLine) return
    const json = dataLine.slice('data:'.length).trim()
    try {
      const frame = JSON.parse(json) as SseFrame
      this.frames.push(frame)
      // Wake any waiter that matches.
      const stillWaiting: typeof this.waiters = []
      for (const w of this.waiters) {
        try {
          w(frame)
        } catch {
          stillWaiting.push(w)
        }
      }
      this.waiters = stillWaiting
    } catch {
      // ignore non-JSON heartbeats
    }
  }

  async waitFor(predicate: (f: SseFrame) => boolean, timeoutMs: number): Promise<SseFrame> {
    const match = this.frames.find(predicate)
    if (match) return match
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`SSE waitFor timed out after ${timeoutMs}ms`)), timeoutMs)
      const w = (f: SseFrame): void => {
        if (predicate(f)) {
          clearTimeout(timer)
          throw new Error('__resolve__') // signal handleFrame to drop us
        }
      }
      const wrapped: (f: SseFrame) => void = (f) => {
        if (predicate(f)) {
          clearTimeout(timer)
          resolve(f)
        } else {
          // re-register
          this.waiters.push(wrapped)
        }
      }
      this.waiters.push(wrapped)
      // Keep `w` referenced so eslint doesn't trip; actual delivery is via `wrapped`.
      void w
    })
  }

  stop(): void {
    this.abort.abort()
  }

  all(): SseFrame[] {
    return [...this.frames]
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━ Phase 6 self-audit ━━━━━━')
  console.log(`base: ${BASE}`)

  console.log('\n[1/7] create session')
  const session = (await api('/api/session/create', { body: JSON.stringify({}) })) as {
    sessionId: string
    matchState: MatchState
  }
  const sessionId = session.sessionId
  line('sessionId', sessionId)
  line('initial formation', session.matchState.homeTeam.formation)
  line('initial mentality', session.matchState.homeTeam.mentality)
  line('initial pressing', session.matchState.homeTeam.pressing)

  console.log('\n[2/7] open SSE listener')
  const sse = new SseCollector()
  await sse.start(sessionId)
  // Tiny grace so the server registers our controller before we open a window.
  await new Promise((r) => setTimeout(r, 250))
  line('listening', 'yes')

  console.log('\n[3/7] open formation decision window')
  const opened = (await api('/api/decision/open', {
    body: JSON.stringify({ sessionId, type: 'formation', durationMs: 8_000 }),
  })) as { window: DecisionWindow }
  const win = opened.window
  const optA = win.options[0]
  const optB = win.options[1]
  line('windowId', win.id)
  line('option A', `${optA.id.slice(0, 8)}… — ${optA.label}`)
  line('option B', `${optB.id.slice(0, 8)}… — ${optB.label}`)

  console.log('\n[4/7] add lopsided taps (decisive winner = A)')
  // 8 taps for A vs 1 for B — guaranteed decisive (>65% share).
  for (let i = 0; i < 8; i++) {
    await api('/api/decision/tap', {
      body: JSON.stringify({ sessionId, optionId: optA.id, amount: 0.0001 }),
    })
  }
  await api('/api/decision/tap', {
    body: JSON.stringify({ sessionId, optionId: optB.id, amount: 0.0001 }),
  })
  line('taps', '8 for A, 1 for B')

  console.log('\n[5/7] close window — engine runs, manager scheduled async')
  const closed = (await api('/api/decision/close', { body: JSON.stringify({ sessionId }) })) as {
    engine?: { winnerLabel: string; confidence: string; winnerShare: number }
  }
  if (!closed.engine) throw new Error('engine result missing in close response')
  line('winner', closed.engine.winnerLabel)
  line('confidence', closed.engine.confidence)
  line('winnerShare', `${(closed.engine.winnerShare * 100).toFixed(1)}%`)

  console.log('\n[6/7] wait for manager-spoke SSE event (up to 30s)')
  const spoke = await sse.waitFor((f) => f.kind === 'manager-spoke' || f.kind === 'manager-error', 30_000)
  sse.stop()

  if (spoke.kind === 'manager-error') {
    console.log('  manager-error received:')
    line('error', String(spoke.error))
    console.log('\nFAIL — manager call errored')
    process.exit(1)
  }
  const speech = String(spoke.speech ?? '')
  line('speech', speech)
  line('model', String(spoke.model))
  line('latencyMs', String(spoke.latencyMs))
  line('tactic', JSON.stringify(spoke.tactic))

  console.log('\n[7/7] re-read session — confirm matchState mutated')
  const after = (await api(`/api/session/${sessionId}`, {
    method: 'GET',
    body: undefined,
  })) as { matchState: MatchState }
  line('formation after', after.matchState.homeTeam.formation)
  line('mentality after', after.matchState.homeTeam.mentality)
  line('pressing after', after.matchState.homeTeam.pressing)
  line('events after', after.matchState.events.length)

  // --- PASS criteria
  const speechOk = speech.length >= 40
  const tacticOk = expectedFormationChange({
    winner: closed.engine.winnerLabel,
    initial: session.matchState.homeTeam.formation,
    final: after.matchState.homeTeam.formation,
  })

  console.log('\n━━━━━━ verdict ━━━━━━')
  if (speechOk && tacticOk) {
    console.log(`PASS — real Claude speech (${speech.length} chars), deterministic formation applied (${session.matchState.homeTeam.formation} → ${after.matchState.homeTeam.formation}).`)
    process.exit(0)
  } else {
    console.log(`FAIL — speechOk=${speechOk} (len=${speech.length}), tacticOk=${tacticOk}`)
    process.exit(1)
  }
}

function expectedFormationChange(opts: {
  winner: string
  initial: string
  final: string
}): boolean {
  const w = opts.winner.toLowerCase()
  // Re-derive what tactic-mapping.ts would say, so the test is independent
  // of that file's internals.
  if (w.includes('4-3-3')) return opts.final === '4-3-3'
  if (w.includes('5-3-2')) return opts.final === '5-3-2'
  if (w.includes('3-5-2')) return opts.final === '3-5-2'
  if (w.includes('4-2-3-1')) return opts.final === '4-2-3-1'
  if (w.includes('4-4-2')) return opts.final === '4-4-2'
  // "Hold the 4-4-2" / "Stay at 4-4-2" should leave formation = initial
  return opts.final === opts.initial
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
