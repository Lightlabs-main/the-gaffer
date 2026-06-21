/**
 * Real decision-engine test harness.
 *
 * Constructs four scenarios — one per confidence level — and prints the
 * engine's verdict alongside the input it was given. No mocks, no
 * pre-computed answers; the verdict is whatever `decide()` actually returns.
 */
import { decide, type EngineTap, type EngineInput } from '../lib/decision-engine'

const CLOSE = 100_000 // arbitrary close timestamp

const OPTIONS = [
  { id: 'A', label: 'Switch to 4-3-3' },
  { id: 'B', label: 'Hold the 4-4-2' },
]

function tapsFlat(optionId: string, count: number, amount: number, fromTs: number, spreadMs: number): EngineTap[] {
  const taps: EngineTap[] = []
  for (let i = 0; i < count; i++) {
    taps.push({ optionId, amount, ts: fromTs + Math.floor((i * spreadMs) / Math.max(1, count - 1)) })
  }
  return taps
}

const scenarios: { name: string; input: EngineInput; expect: string }[] = [
  {
    name: 'DECISIVE — 73% goes to "Switch to 4-3-3"',
    expect: 'decisive',
    input: {
      options: OPTIONS,
      windowClosesAt: CLOSE,
      // 73 taps for A, 27 for B (= 73% / 27%) spread across most of the window
      taps: [
        ...tapsFlat('A', 73, 0.0001, CLOSE - 28_000, 18_000),
        ...tapsFlat('B', 27, 0.0001, CLOSE - 28_000, 18_000),
      ],
    },
  },
  {
    name: 'NARROW — 60% goes to "Switch to 4-3-3"',
    expect: 'narrow',
    input: {
      options: OPTIONS,
      windowClosesAt: CLOSE,
      taps: [
        ...tapsFlat('A', 60, 0.0001, CLOSE - 28_000, 18_000),
        ...tapsFlat('B', 40, 0.0001, CLOSE - 28_000, 18_000),
      ],
    },
  },
  {
    name: 'DIVIDED — 52/48 split',
    expect: 'divided',
    input: {
      options: OPTIONS,
      windowClosesAt: CLOSE,
      taps: [
        ...tapsFlat('A', 52, 0.0001, CLOSE - 28_000, 18_000),
        ...tapsFlat('B', 48, 0.0001, CLOSE - 28_000, 18_000),
      ],
    },
  },
  {
    name: 'REVERSAL — A leads through window, B surges in final 10s and overtakes',
    expect: 'reversal',
    input: {
      options: OPTIONS,
      windowClosesAt: CLOSE,
      // First 20s: A leads 40 to 10
      taps: [
        ...tapsFlat('A', 40, 0.0001, CLOSE - 28_000, 17_000), // ends ~CLOSE-11s
        ...tapsFlat('B', 10, 0.0001, CLOSE - 28_000, 17_000),
        // Final 10s: B floods in with 80 taps, A taps just 5
        ...tapsFlat('B', 80, 0.0001, CLOSE - 9_000, 8_000),
        ...tapsFlat('A', 5, 0.0001, CLOSE - 9_000, 8_000),
      ],
    },
  },
]

let allOk = true
for (const sc of scenarios) {
  const r = decide(sc.input)
  const ok = r.confidence === sc.expect
  if (!ok) allOk = false
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(sc.name)
  console.log(`  expected confidence : ${sc.expect}`)
  console.log(`  actual   confidence : ${r.confidence}   ${ok ? '✓' : '✗'}`)
  console.log(`  winner              : "${r.winnerLabel}"`)
  console.log(`  winnerShare         : ${(r.winnerShare * 100).toFixed(1)}%`)
  console.log(`  totalStreamed       : ${r.totalStreamed.toFixed(6)} USDC`)
  console.log(`  signal              : ${r.signal}`)
  console.log('  breakdown:')
  for (const b of r.breakdown) {
    console.log(
      `    [${b.id}] ${b.label.padEnd(20)} total=${b.total.toFixed(6)}  share=${(b.share * 100).toFixed(1)}%  finalSurge=${b.finalSurge.toFixed(6)}`,
    )
  }
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(allOk ? 'ALL SCENARIOS PASSED' : 'AT LEAST ONE SCENARIO FAILED')
process.exit(allOk ? 0 : 1)
