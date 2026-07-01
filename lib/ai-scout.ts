import type { DecisionOption, DecisionWindow, MatchState } from './types'

export interface ScoutWindowProposal {
  agentName: 'AI Scout'
  observation: string
  prompt: string
  type: DecisionWindow['type']
  options: [
    { label: string; description: string },
    { label: string; description: string },
  ]
  recommendation: 'A' | 'B'
  confidence: number
}

type MatchRead = {
  scoreDiff: number
  late: boolean
  leftBackIsolated: boolean
  centralCrowded: boolean
  needsControl: boolean
  chasing: boolean
}

export function proposeScoutWindow(
  matchState: MatchState,
  requestedType: DecisionWindow['type'] = 'pressing',
): ScoutWindowProposal {
  const read = readMatch(matchState)

  if (read.leftBackIsolated) {
    return {
      agentName: 'AI Scout',
      observation: 'Their left back is isolated when we switch play quickly.',
      prompt: 'Exploit the weak side now?',
      type: requestedType,
      options: [
        {
          label: 'Attack left flank',
          description: 'Move the USDC signal toward the isolated full-back and overload wide.',
        },
        {
          label: 'Stay central',
          description: 'Keep the ball inside and avoid stretching the midfield shape.',
        },
      ],
      recommendation: 'A',
      confidence: read.late ? 78 : 72,
    }
  }

  if (read.chasing) {
    return {
      agentName: 'AI Scout',
      observation: 'We are behind and the next five minutes need a sharper attacking trigger.',
      prompt: 'Chase the match?',
      type: requestedType,
      options: [
        {
          label: 'Push full-backs on',
          description: 'Turn the USDC signal into width, runners, and earlier balls into the box.',
        },
        {
          label: 'Protect midfield',
          description: 'Stay central, keep rest defence, and wait for a cleaner opening.',
        },
      ],
      recommendation: 'A',
      confidence: 76,
    }
  }

  if (read.needsControl) {
    return {
      agentName: 'AI Scout',
      observation: 'We have the lead; the dangerous space is behind our midfield line.',
      prompt: 'Protect the lead or keep pressing?',
      type: requestedType,
      options: [
        {
          label: 'Lock the middle',
          description: 'Stream USDC toward control: narrower shape, fewer turnovers, slower tempo.',
        },
        {
          label: 'Keep hunting',
          description: 'Stay aggressive and use pressure to force the next mistake.',
        },
      ],
      recommendation: 'A',
      confidence: read.late ? 82 : 68,
    }
  }

  if (read.centralCrowded) {
    return {
      agentName: 'AI Scout',
      observation: 'The centre is crowded, but the far-side winger has room to receive.',
      prompt: 'Where should the next attack go?',
      type: requestedType,
      options: [
        {
          label: 'Switch wide early',
          description: 'Use USDC to call the wide rotation before the block resets.',
        },
        {
          label: 'Stay central',
          description: 'Keep combining through the pocket and trust the current shape.',
        },
      ],
      recommendation: 'A',
      confidence: 69,
    }
  }

  return {
    agentName: 'AI Scout',
    observation: 'The match is balanced; the next USDC signal should decide whether to add risk or keep structure.',
    prompt: 'Tilt the next phase?',
    type: requestedType,
    options: [
      {
        label: 'Raise the tempo',
        description: 'Push the crowd signal toward faster attacks and earlier pressure.',
      },
      {
        label: 'Stay central',
        description: 'Keep the current structure and let the match settle.',
      },
    ],
    recommendation: 'B',
    confidence: 61,
  }
}

export function buildScoutDecisionWindow(
  matchState: MatchState,
  requestedType: DecisionWindow['type'],
  opensAtMs: number,
): DecisionWindow {
  const proposal = proposeScoutWindow(matchState, requestedType)
  const options: DecisionOption[] = proposal.options.map((option) => ({
    id: makeId(),
    label: option.label,
    description: option.description,
    totalStreamed: 0,
    streamingRate: 0,
    lastUpdated: opensAtMs,
  }))

  return {
    id: makeId(),
    type: proposal.type,
    prompt: proposal.prompt,
    options,
    opensAt: opensAtMs,
    closesAt: opensAtMs + 30_000,
    isOpen: true,
  }
}

function readMatch(matchState: MatchState): MatchRead {
  const recent = matchState.events.slice(-5)
  const recentPressure = recent.some((event) => event.type === 'chance' || event.type === 'goal-conceded')
  const recentGoal = recent.some((event) => event.type === 'goal' || event.type === 'goal-conceded')
  const scoreDiff = matchState.homeTeam.score - matchState.awayTeam.score
  const late = matchState.minute >= 65

  return {
    scoreDiff,
    late,
    leftBackIsolated:
      matchState.homeTeam.mentality === 'attacking' ||
      matchState.homeTeam.pressing === 'high' ||
      (matchState.minute >= 20 && !recentGoal),
    centralCrowded:
      matchState.homeTeam.formation === '4-2-3-1' ||
      matchState.awayTeam.formation === '5-3-2',
    needsControl: scoreDiff > 0 && (late || recentPressure),
    chasing: scoreDiff < 0 || (late && scoreDiff === 0),
  }
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
