/**
 * Decision-window lifecycle on a Session.
 *
 * Responsibilities:
 *   - openDecisionWindow: stamps a fresh DecisionWindow onto matchState,
 *     clears the per-window tap history, broadcasts `decision-opened`, and
 *     schedules an auto-close at the window's `closesAt`.
 *   - recordTap: append one tap to the per-window history and update the
 *     winning option's totalStreamed + streamingRate. Phase 5 (the x402
 *     stream endpoint) will be the real caller; Phase 4 uses it via a
 *     debug endpoint to construct scenarios.
 *   - closeDecisionWindow: idempotent. Runs the engine, sets isOpen=false +
 *     result + signal, broadcasts `decision-closed`.
 *
 * Tap history lives in a side-store keyed by sessionId (out-of-band from
 * the shared types so we don't have to mutate the spec's interfaces).
 */
import { randomUUID } from 'node:crypto'
import type { Session, DecisionWindow, MatchEvent } from './types'
import { broadcast } from './sse'
import { decide, type EngineTap, type EngineResult } from './decision-engine'
import { produceManagerVerdict } from './manager'
import { resolveTactic } from './tactic-mapping'

interface WindowState {
  windowId: string
  taps: EngineTap[]
  closeTimer: ReturnType<typeof setTimeout> | null
}

const windowStateBySession = new Map<string, WindowState>()

function ensureWindowState(sessionId: string, windowId: string): WindowState {
  const existing = windowStateBySession.get(sessionId)
  if (existing && existing.windowId === windowId) return existing
  if (existing?.closeTimer) clearTimeout(existing.closeTimer)
  const fresh: WindowState = { windowId, taps: [], closeTimer: null }
  windowStateBySession.set(sessionId, fresh)
  return fresh
}

export function getTaps(sessionId: string): EngineTap[] {
  return windowStateBySession.get(sessionId)?.taps ?? []
}

export function openDecisionWindow(
  session: Session,
  window: DecisionWindow,
): DecisionWindow {
  session.matchState.currentDecision = window
  const state = ensureWindowState(session.id, window.id)
  state.taps = []
  // Auto-close on schedule
  const msUntilClose = Math.max(0, window.closesAt - Date.now())
  state.closeTimer = setTimeout(() => {
    closeDecisionWindow(session)
  }, msUntilClose)

  broadcast(session, {
    kind: 'decision-opened',
    window,
    serverTime: Date.now(),
  })
  return window
}

export interface TapInput {
  optionId: string
  amount: number // USDC (decimal, e.g. 0.0001)
  ts?: number
}

export function recordTap(session: Session, input: TapInput): {
  accepted: boolean
  reason?: string
  totalForOption?: number
} {
  const decision = session.matchState.currentDecision
  if (!decision || !decision.isOpen) {
    return { accepted: false, reason: 'no open decision window' }
  }
  const option = decision.options.find((o) => o.id === input.optionId)
  if (!option) {
    return { accepted: false, reason: 'unknown optionId for current window' }
  }
  const now = input.ts ?? Date.now()
  if (now > decision.closesAt) {
    return { accepted: false, reason: 'window already closed by timestamp' }
  }
  const state = ensureWindowState(session.id, decision.id)
  state.taps.push({ optionId: input.optionId, amount: input.amount, ts: now })

  option.totalStreamed += input.amount
  session.matchState.totalEarned += input.amount
  // streamingRate: USDC per second, smoothed over the most recent 2s of taps
  const recentCutoff = now - 2_000
  const recentForOption = state.taps.filter(
    (t) => t.optionId === input.optionId && t.ts >= recentCutoff,
  )
  const recentTotal = recentForOption.reduce((a, b) => a + b.amount, 0)
  option.streamingRate = recentTotal / 2
  option.lastUpdated = now

  // Per-tap broadcast so the UI bar moves in real time
  broadcast(session, {
    kind: 'tap',
    windowId: decision.id,
    optionId: input.optionId,
    totalForOption: option.totalStreamed,
    streamingRate: option.streamingRate,
    ts: now,
  })

  return { accepted: true, totalForOption: option.totalStreamed }
}

export function closeDecisionWindow(session: Session): {
  alreadyClosed: boolean
  window?: DecisionWindow
  engine?: EngineResult
} {
  const decision = session.matchState.currentDecision
  if (!decision) return { alreadyClosed: true }
  if (!decision.isOpen) {
    return { alreadyClosed: true, window: decision }
  }
  const state = ensureWindowState(session.id, decision.id)
  if (state.closeTimer) {
    clearTimeout(state.closeTimer)
    state.closeTimer = null
  }
  const engine = decide({
    options: decision.options.map((o) => ({ id: o.id, label: o.label })),
    taps: state.taps,
    windowClosesAt: decision.closesAt,
  })
  decision.isOpen = false
  decision.result = engine.winnerLabel
  broadcast(session, {
    kind: 'decision-closed',
    window: decision,
    engine,
    serverTime: Date.now(),
  })
  // Fire the AI Manager asynchronously. We don't await — the
  // decision-closed broadcast went out instantly; the manager's speech
  // arrives shortly after as a separate `manager-spoke` SSE event, and
  // the deterministic tactic mutation is applied at the same time.
  void runManagerForWindow(session, decision, engine)
  return { alreadyClosed: false, window: decision, engine }
}

/**
 * Phase 6: ask Claude for the manager speech, apply the deterministic
 * tactic change to MatchState, broadcast `manager-spoke`. Runs after the
 * `decision-closed` broadcast has already fired.
 *
 * Failure mode: if Claude errors we broadcast a `manager-error` event with
 * the error message so the UI can show "the manager fell silent" without
 * the build pretending success. No fake speeches.
 */
async function runManagerForWindow(
  session: Session,
  decision: DecisionWindow,
  engine: EngineResult,
): Promise<void> {
  try {
    const verdict = await produceManagerVerdict({
      matchState: session.matchState,
      decision,
      engine,
    })
    decision.managerSpeech = verdict.speech

    // Apply the deterministic tactic change.
    const tactic = resolveTactic(decision.type, engine.winnerLabel)
    let appliedTactic:
      | { kind: 'state'; field: string; value: string; previous: string }
      | { kind: 'event'; eventType: string; text: string }
      | { kind: 'noop'; reason: string }
    if (tactic.kind === 'state') {
      const previous = session.matchState.homeTeam[tactic.field] as string
      // The tactic types narrow field+value enough that this assignment is
      // sound; we cast in one place to avoid 12 lines of switch.
      ;(session.matchState.homeTeam as Record<string, unknown>)[tactic.field] =
        tactic.value
      appliedTactic = {
        kind: 'state',
        field: tactic.field,
        value: tactic.value,
        previous,
      }
    } else if (tactic.kind === 'event') {
      const event: MatchEvent = {
        id: randomUUID(),
        minute: session.matchState.minute,
        type: tactic.eventType,
        text: tactic.text,
      }
      session.matchState.events.push(event)
      appliedTactic = { kind: 'event', eventType: tactic.eventType, text: tactic.text }
    } else {
      appliedTactic = { kind: 'noop', reason: tactic.reason }
    }

    broadcast(session, {
      kind: 'manager-spoke',
      windowId: decision.id,
      speech: verdict.speech,
      model: verdict.model,
      latencyMs: verdict.latencyMs,
      requestId: verdict.requestId,
      tactic: appliedTactic,
      serverTime: Date.now(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[manager] failed for window', decision.id, message)
    broadcast(session, {
      kind: 'manager-error',
      windowId: decision.id,
      error: message,
      serverTime: Date.now(),
    })
  }
}
