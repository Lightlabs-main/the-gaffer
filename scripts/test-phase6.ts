import { produceManagerVerdict } from '../lib/manager'
import { simulateMatchSegment } from '../lib/match-simulator'
import type { DecisionWindow, MatchState } from '../lib/types'
import type { EngineResult } from '../lib/decision-engine'

const baseMatch: MatchState = {
  id: 'phase6-local-proof',
  experienceType: 'football-simulation',
  experienceLabel: 'Football simulation stream',
  experienceSummary: 'Fans manage a live simulated club through tactical USDC streams.',
  creatorWalletId: 'not-used-in-phase6',
  creatorAddress: '0x0000000000000000000000000000000000000000',
  homeTeam: {
    name: 'The Crowd FC',
    score: 1,
    formation: '4-4-2',
    mentality: 'balanced',
    pressing: 'mid',
  },
  awayTeam: {
    name: 'Algorithm United',
    score: 1,
    formation: '4-4-2',
  },
  minute: 62,
  status: 'second-half',
  events: [
    {
      id: 'event-1',
      minute: 58,
      type: 'chance',
      text: 'The Crowd FC forced a save from the edge of the box.',
    },
  ],
  totalEarned: 0.0012,
}

const decision: DecisionWindow = {
  id: 'phase6-decision',
  type: 'mentality',
  prompt: 'How do we play this spell?',
  options: [
    {
      id: 'attack',
      label: 'Go attacking',
      description: 'Commit runners and chase the winner.',
      totalStreamed: 0.001,
      streamingRate: 0,
      lastUpdated: Date.now(),
    },
    {
      id: 'defend',
      label: 'Shut it down',
      description: 'Protect the point and slow the tempo.',
      totalStreamed: 0.0002,
      streamingRate: 0,
      lastUpdated: Date.now(),
    },
  ],
  opensAt: Date.now() - 30_000,
  closesAt: Date.now(),
  isOpen: false,
}

function engine(confidence: EngineResult['confidence']): EngineResult {
  const share =
    confidence === 'decisive'
      ? 0.83
      : confidence === 'narrow'
        ? 0.57
        : confidence === 'divided'
          ? 0.52
          : 0.61
  return {
    winnerId: 'attack',
    winnerLabel: 'Go attacking',
    confidence,
    winnerShare: share,
    totalStreamed: 0.0012,
    signal:
      confidence === 'reversal'
        ? 'The defensive option led until a late attacking surge flipped the window.'
        : `${(share * 100).toFixed(1)}% of the money chose attacking football.`,
    breakdown: [
      {
        id: 'attack',
        label: 'Go attacking',
        total: 0.001,
        share,
        finalSurge: confidence === 'reversal' ? 0.0006 : 0.0001,
      },
      {
        id: 'defend',
        label: 'Shut it down',
        total: 0.0002,
        share: 1 - share,
        finalSurge: 0.00005,
      },
    ],
  }
}

async function main() {
  console.log('Phase 6 Opus proof: real Claude manager + simulator calls')
  for (const confidence of ['decisive', 'narrow', 'divided', 'reversal'] as const) {
    const verdict = await produceManagerVerdict({
      matchState: baseMatch,
      decision,
      engine: engine(confidence),
    })
    console.log(`\n[manager:${confidence}]`)
    console.log(`model=${verdict.model}`)
    console.log(`requestId=${verdict.requestId}`)
    console.log(`latencyMs=${verdict.latencyMs}`)
    console.log(verdict.speech)
  }

  const attacking = await simulateMatchSegment({
    matchState: {
      ...baseMatch,
      homeTeam: { ...baseMatch.homeTeam, mentality: 'attacking', pressing: 'high' },
    },
    fromMinute: 63,
    toMinute: 75,
  })
  const defensive = await simulateMatchSegment({
    matchState: {
      ...baseMatch,
      homeTeam: { ...baseMatch.homeTeam, formation: '5-3-2', mentality: 'defensive', pressing: 'low' },
    },
    fromMinute: 63,
    toMinute: 75,
  })

  console.log('\n[simulator:attacking]')
  console.log(`model=${attacking.model}`)
  console.log(JSON.stringify(attacking.events, null, 2))

  console.log('\n[simulator:defensive]')
  console.log(`model=${defensive.model}`)
  console.log(JSON.stringify(defensive.events, null, 2))
}

main().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
