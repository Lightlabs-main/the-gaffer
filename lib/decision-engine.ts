/**
 * Decision engine — reads the money signal for a closing window and reports
 * which option won and how confident the crowd was.
 *
 * Confidence levels (spec, in priority order):
 *   - reversal: the option that led at (closesAt - 10s) is NOT the option
 *               that leads at close — the crowd flipped at the last second.
 *               Detected by replaying the tap history.
 *   - divided:  the top two options are within 10 percentage points of each
 *               other (e.g. 52/48 — the crowd genuinely couldn't decide).
 *   - decisive: the winning option pulled in more than 65% of total volume.
 *   - narrow:   between 50% and 65% — a clear-ish winner, no drama.
 *
 * Pure function. Side-effect-free. Takes its inputs explicitly so that the
 * test harness can construct any scenario without touching the session store.
 */
export type Confidence = 'decisive' | 'narrow' | 'divided' | 'reversal'

export interface EngineTap {
  optionId: string
  amount: number
  ts: number // ms epoch
}

export interface EngineOptionInput {
  id: string
  label: string
}

export interface EngineInput {
  options: EngineOptionInput[]
  taps: EngineTap[]
  windowClosesAt: number
  surgeWindowMs?: number // default 10_000
}

export interface EngineBreakdownEntry {
  id: string
  label: string
  total: number
  share: number // 0..1 of total volume
  finalSurge: number // volume in the surge window
}

export interface EngineResult {
  winnerId: string
  winnerLabel: string
  confidence: Confidence
  winnerShare: number // 0..1
  totalStreamed: number
  signal: string // plain-English summary
  breakdown: EngineBreakdownEntry[]
}

function sumTapsForOption(taps: EngineTap[], optionId: string): number {
  let s = 0
  for (const t of taps) if (t.optionId === optionId) s += t.amount
  return s
}

function leadingOptionId(totalsById: Map<string, number>): string {
  let bestId = ''
  let bestTotal = -1
  for (const [id, total] of totalsById) {
    if (total > bestTotal) {
      bestTotal = total
      bestId = id
    }
  }
  return bestId
}

export function decide(input: EngineInput): EngineResult {
  if (input.options.length < 2) {
    throw new Error('decide() requires at least 2 options')
  }
  const surgeWindowMs = input.surgeWindowMs ?? 10_000
  const preSurgeBoundary = input.windowClosesAt - surgeWindowMs

  // Cumulative totals at close
  const cumTotals = new Map<string, number>()
  for (const o of input.options) {
    cumTotals.set(o.id, sumTapsForOption(input.taps, o.id))
  }
  const totalStreamed = Array.from(cumTotals.values()).reduce((a, b) => a + b, 0)

  // Totals at (closesAt - surgeWindowMs) — the snapshot before the final 10s
  const preSurgeTotals = new Map<string, number>()
  for (const o of input.options) {
    preSurgeTotals.set(
      o.id,
      input.taps
        .filter((t) => t.optionId === o.id && t.ts <= preSurgeBoundary)
        .reduce((a, b) => a + b.amount, 0),
    )
  }

  // Final-surge totals (volume in the last `surgeWindowMs`)
  const surgeTotals = new Map<string, number>()
  for (const o of input.options) {
    surgeTotals.set(
      o.id,
      input.taps
        .filter((t) => t.optionId === o.id && t.ts > preSurgeBoundary)
        .reduce((a, b) => a + b.amount, 0),
    )
  }

  const finalWinnerId = leadingOptionId(cumTotals)
  const preSurgeWinnerId = totalStreamed > 0 ? leadingOptionId(preSurgeTotals) : finalWinnerId

  const finalWinnerLabel = input.options.find((o) => o.id === finalWinnerId)?.label ?? finalWinnerId
  const winnerTotal = cumTotals.get(finalWinnerId) ?? 0
  const winnerShare = totalStreamed > 0 ? winnerTotal / totalStreamed : 0

  // Confidence classification — priority order
  let confidence: Confidence
  if (
    totalStreamed > 0 &&
    preSurgeWinnerId !== '' &&
    finalWinnerId !== preSurgeWinnerId &&
    (preSurgeTotals.get(preSurgeWinnerId) ?? 0) > 0
  ) {
    confidence = 'reversal'
  } else {
    // Sorted shares descending
    const shares = Array.from(cumTotals.values()).sort((a, b) => b - a)
    const topShare = totalStreamed > 0 ? shares[0] / totalStreamed : 0
    const runnerUpShare = totalStreamed > 0 ? (shares[1] ?? 0) / totalStreamed : 0
    const gap = topShare - runnerUpShare
    if (gap <= 0.1) {
      confidence = 'divided'
    } else if (topShare > 0.65) {
      confidence = 'decisive'
    } else {
      confidence = 'narrow'
    }
  }

  const breakdown: EngineBreakdownEntry[] = input.options.map((o) => {
    const total = cumTotals.get(o.id) ?? 0
    return {
      id: o.id,
      label: o.label,
      total,
      share: totalStreamed > 0 ? total / totalStreamed : 0,
      finalSurge: surgeTotals.get(o.id) ?? 0,
    }
  })

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  let signal: string
  if (totalStreamed === 0) {
    signal = 'No money streamed — defaulting to first option.'
  } else if (confidence === 'reversal') {
    const preLabel =
      input.options.find((o) => o.id === preSurgeWinnerId)?.label ?? preSurgeWinnerId
    signal = `Reversal — "${preLabel}" was leading until the final ${
      surgeWindowMs / 1000
    }s, then "${finalWinnerLabel}" surged ahead to win with ${pct(winnerShare)}.`
  } else if (confidence === 'decisive') {
    signal = `Decisive — ${pct(winnerShare)} of the money went to "${finalWinnerLabel}".`
  } else if (confidence === 'divided') {
    signal = `Divided — top two options within 10 points (${pct(winnerShare)} vs ${pct(
      1 - winnerShare,
    )}). "${finalWinnerLabel}" edges it.`
  } else {
    signal = `Narrow — ${pct(winnerShare)} of the money went to "${finalWinnerLabel}".`
  }

  return {
    winnerId: finalWinnerId,
    winnerLabel: finalWinnerLabel,
    confidence,
    winnerShare,
    totalStreamed,
    signal,
    breakdown,
  }
}
