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
import type { Session, DecisionWindow } from './types'
import { broadcast } from './sse'
import { decide, type EngineTap, type EngineResult } from './decision-engine'

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
  // managerSpeech stays unset — Phase 6 (AI Manager) populates it.
  broadcast(session, {
    kind: 'decision-closed',
    window: decision,
    engine,
    serverTime: Date.now(),
  })
  return { alreadyClosed: false, window: decision, engine }
}
