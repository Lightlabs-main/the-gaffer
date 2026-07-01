/**
 * Deterministic mapping from a DecisionWindow verdict (window type + winner
 * label) to a concrete MatchState mutation.
 *
 * Why this is mechanical, not LLM-decided:
 *   The LLM (Phase 6 AI Manager) produces the SPEECH — the football-manager
 *   monologue announcing the call. State changes that the simulator (Phase 7)
 *   reads must be deterministic from the inputs, so a non-coder can inspect
 *   the table here and predict exactly what the tactic does to the next
 *   15 minutes of simulated football. No LLM whimsy in the simulation loop.
 *
 * Coverage:
 *   - formation  → mutates homeTeam.formation
 *   - mentality  → mutates homeTeam.mentality
 *   - pressing   → mutates homeTeam.pressing
 *   - substitution / set-piece / crisis / push-or-hold → appends a
 *     MatchEvent describing what the manager did; Phase 7's simulator
 *     reads the most recent of these per category to bias its event
 *     generation.
 *
 * Returns:
 *   - `kind: 'state'` for shape/mentality/pressing changes
 *   - `kind: 'event'` for the rest, with an event-text describing the
 *     manager's actual call (so the SSE stream and the speech line up)
 *   - `kind: 'noop'` if the winning option explicitly maintains current
 *     state (e.g. "Hold the 4-4-2" with formation already 4-4-2)
 */
import type { DecisionWindow, Formation, Mentality, PressingStyle } from './types'

export type TacticOutcome =
  | { kind: 'state'; field: 'formation'; value: Formation }
  | { kind: 'state'; field: 'mentality'; value: Mentality }
  | { kind: 'state'; field: 'pressing'; value: PressingStyle }
  | { kind: 'event'; eventType: 'substitution' | 'commentary'; text: string }
  | { kind: 'noop'; reason: string }

/**
 * Resolve a decision window's verdict into the concrete tactic change.
 * Pure function — does not mutate anything. The caller (decision-lifecycle)
 * applies the result.
 */
export function resolveTactic(
  windowType: DecisionWindow['type'],
  winnerLabel: string,
): TacticOutcome {
  const normalised = winnerLabel.trim().toLowerCase()

  switch (windowType) {
    case 'formation':
      return resolveFormation(normalised, winnerLabel)
    case 'mentality':
      return resolveMentality(normalised, winnerLabel)
    case 'pressing':
      return resolvePressing(normalised, winnerLabel)
    case 'substitution':
      return {
        kind: 'event',
        eventType: 'substitution',
        text: `Manager: ${winnerLabel}.`,
      }
    case 'set-piece':
      return {
        kind: 'event',
        eventType: 'commentary',
        text: `Set-piece call — ${winnerLabel}.`,
      }
    case 'crisis':
      return {
        kind: 'event',
        eventType: 'commentary',
        text: `Crisis response — ${winnerLabel}.`,
      }
    case 'push-or-hold':
      return {
        kind: 'event',
        eventType: 'commentary',
        text: `Late game call — ${winnerLabel}.`,
      }
  }
}

function resolveFormation(n: string, original: string): TacticOutcome {
  // Patterns match the option labels in window-catalog.ts.
  if (n.includes('4-3-3')) return { kind: 'state', field: 'formation', value: '4-3-3' }
  if (n.includes('5-3-2')) return { kind: 'state', field: 'formation', value: '5-3-2' }
  if (n.includes('3-5-2')) return { kind: 'state', field: 'formation', value: '3-5-2' }
  if (n.includes('4-2-3-1')) return { kind: 'state', field: 'formation', value: '4-2-3-1' }
  if (n.includes('4-4-2')) return { kind: 'state', field: 'formation', value: '4-4-2' }
  if (n.includes('left flank') || n.includes('wide') || n.includes('tempo')) {
    return { kind: 'state', field: 'formation', value: '4-3-3' }
  }
  if (n.includes('central') || n.includes('middle') || n.includes('control')) {
    return { kind: 'state', field: 'formation', value: '4-2-3-1' }
  }
  return { kind: 'noop', reason: `formation verdict "${original}" did not match any known shape` }
}

function resolveMentality(n: string, original: string): TacticOutcome {
  if (n.includes('attack')) return { kind: 'state', field: 'mentality', value: 'attacking' }
  if (n.includes('push') || n.includes('wide') || n.includes('tempo') || n.includes('hunting')) {
    return { kind: 'state', field: 'mentality', value: 'attacking' }
  }
  if (n.includes('defens')) return { kind: 'state', field: 'mentality', value: 'defensive' }
  if (n.includes('protect') || n.includes('lock')) {
    return { kind: 'state', field: 'mentality', value: 'defensive' }
  }
  if (n.includes('balanc')) return { kind: 'state', field: 'mentality', value: 'balanced' }
  if (n.includes('central') || n.includes('control')) return { kind: 'state', field: 'mentality', value: 'balanced' }
  return { kind: 'noop', reason: `mentality verdict "${original}" did not match` }
}

function resolvePressing(n: string, original: string): TacticOutcome {
  if (n.includes('high')) return { kind: 'state', field: 'pressing', value: 'high' }
  if (n.includes('attack') || n.includes('push') || n.includes('tempo') || n.includes('hunting')) {
    return { kind: 'state', field: 'pressing', value: 'high' }
  }
  if (n.includes('sit off') || n.includes('low')) {
    return { kind: 'state', field: 'pressing', value: 'low' }
  }
  if (n.includes('protect') || n.includes('lock')) return { kind: 'state', field: 'pressing', value: 'low' }
  if (n.includes('mid')) return { kind: 'state', field: 'pressing', value: 'mid' }
  if (n.includes('central') || n.includes('control')) return { kind: 'state', field: 'pressing', value: 'mid' }
  return { kind: 'noop', reason: `pressing verdict "${original}" did not match` }
}
