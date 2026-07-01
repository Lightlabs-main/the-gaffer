import type { CrowdChoiceMemory, MatchState, OpponentCoachState } from './types'

export function updateOpponentCoach(
  matchState: MatchState,
  latestChoice: CrowdChoiceMemory,
): OpponentCoachState {
  const previous = matchState.opponentCoach
  const wideAttackCount =
    (previous?.wideAttackCount ?? 0) + (isWideAttack(latestChoice.winnerLabel) ? 1 : 0)
  const centralControlCount =
    (previous?.centralControlCount ?? 0) + (isCentralControl(latestChoice.winnerLabel) ? 1 : 0)
  const highPressCount =
    (previous?.highPressCount ?? 0) + (isHighPress(latestChoice.winnerLabel) ? 1 : 0)

  let state: OpponentCoachState
  if (wideAttackCount >= 2) {
    state = {
      tendency: 'wide_attack',
      reaction: 'The opponent coach has seen the crowd keep attacking wide.',
      tacticalShift: 'Their full-back drops five yards deeper and the winger tracks the overlap.',
      updatedAtMinute: matchState.minute,
      wideAttackCount,
      centralControlCount,
      highPressCount,
    }
  } else if (highPressCount >= 2) {
    state = {
      tendency: 'high_press',
      reaction: 'The opponent coach expects pressure on the first pass.',
      tacticalShift: 'Their centre-backs split wider and the six checks short to play through pressure.',
      updatedAtMinute: matchState.minute,
      wideAttackCount,
      centralControlCount,
      highPressCount,
    }
  } else if (centralControlCount >= 2) {
    state = {
      tendency: 'central_control',
      reaction: 'The opponent coach reads the crowd trying to own the middle.',
      tacticalShift: 'Their midfield narrows and leaves the far-side switch open as a trap.',
      updatedAtMinute: matchState.minute,
      wideAttackCount,
      centralControlCount,
      highPressCount,
    }
  } else if (matchState.homeTeam.score > matchState.awayTeam.score && matchState.minute >= 60) {
    state = {
      tendency: 'protect_lead',
      reaction: 'The opponent coach sees the crowd protecting a lead.',
      tacticalShift: 'They push an extra runner between centre-back and full-back to force a decision.',
      updatedAtMinute: matchState.minute,
      wideAttackCount,
      centralControlCount,
      highPressCount,
    }
  } else {
    state = {
      tendency: 'mixed',
      reaction: 'The opponent coach has not found a stable crowd pattern yet.',
      tacticalShift: 'They hold their base shape and wait for one more crowd signal.',
      updatedAtMinute: matchState.minute,
      wideAttackCount,
      centralControlCount,
      highPressCount,
    }
  }

  matchState.opponentCoach = state
  return state
}

function isWideAttack(label: string): boolean {
  const n = label.toLowerCase()
  return n.includes('wide') || n.includes('flank') || n.includes('full-back')
}

function isCentralControl(label: string): boolean {
  const n = label.toLowerCase()
  return n.includes('central') || n.includes('middle') || n.includes('control')
}

function isHighPress(label: string): boolean {
  const n = label.toLowerCase()
  return n.includes('press') || n.includes('tempo') || n.includes('hunting')
}
