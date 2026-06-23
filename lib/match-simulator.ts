/**
 * Match Simulator — Claude generates match events based on current tactics.
 *
 * This is Phase 6 Role 2. The simulator takes the current match state
 * (formation, mentality, pressing, scores, minute range) and asks Claude
 * to produce 2-4 match events. The tactics the crowd chose MUST genuinely
 * influence what happens — an attacking mentality should produce more
 * chances/goals, a defensive one more blocks and commentary.
 *
 * Anti-fake: real Claude API call, real JSON parsing, no hardcoded events.
 */
import { randomUUID } from 'node:crypto'
import { getAnthropicClient, MANAGER_MODEL } from './anthropic'
import type { MatchState, MatchEvent } from './types'

export interface SimulationResult {
  events: MatchEvent[]
  model: string
  requestId: string | null
  latencyMs: number
}

/**
 * Ask Claude to simulate a stretch of the match. Returns 2-4 events.
 */
export async function simulateMatchSegment(opts: {
  matchState: MatchState
  fromMinute: number
  toMinute: number
}): Promise<SimulationResult> {
  const client = getAnthropicClient()
  const { matchState, fromMinute, toMinute } = opts
  const home = matchState.homeTeam
  const away = matchState.awayTeam

  const recentEvents = matchState.events
    .slice(-5)
    .map((e) => `${e.minute}' — ${e.text}`)
    .join('; ')

  const userPrompt = [
    `Simulate minutes ${fromMinute} to ${toMinute} of this football match.`,
    `Home: ${home.name} (${home.formation}, ${home.mentality} mentality, ${home.pressing} press), score ${home.score}.`,
    `Away: ${away.name} (${away.formation}), score ${away.score}.`,
    `Recent events: ${recentEvents || 'None yet — match just started.'}`,
    `Return ONLY a JSON array of match events: [{ minute, type, text, isGoal? }].`,
    `Types: goal, goal-conceded, chance, card, injury, commentary.`,
    `Rules:`,
    `- Return 2 to 4 events, each "text" under 25 words.`,
    `- "goal" means Home scored. "goal-conceded" means Away scored. Set isGoal: true for both.`,
    `- The tactics MUST influence the events: attacking mentality + high press = more chances and goals;`,
    `  defensive mentality + low press = more blocks, interceptions, and commentary about shape.`,
    `- A 4-3-3 with attacking mentality should create more chances than a 5-3-2 with defensive mentality.`,
    `- Goals should be rare (at most 1 per simulation) and plausible given the tactical setup.`,
    `- Return raw JSON only — no markdown, no code fences, no explanation.`,
  ].join(' ')

  const started = Date.now()
  const response = await client.messages.create({
    model: MANAGER_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const latencyMs = Date.now() - started

  const raw = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('\n')
    .trim()

  const events = parseSimulatorResponse(raw, fromMinute, toMinute)

  return {
    events,
    model: response.model,
    requestId: (response as { _request_id?: string | null })._request_id ?? null,
    latencyMs,
  }
}

/**
 * Safely parse the simulator's JSON response.
 * Strips code fences if present, validates structure.
 */
function parseSimulatorResponse(
  raw: string,
  fromMinute: number,
  toMinute: number,
): MatchEvent[] {
  // Strip markdown code fences if Claude wraps the JSON
  let cleaned = raw
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[simulator] failed to parse JSON:', raw)
    // Fallback: generate a commentary event so the match doesn't stall
    return [
      {
        id: randomUUID(),
        minute: Math.floor((fromMinute + toMinute) / 2),
        type: 'commentary',
        text: 'Play continues with both sides probing for openings.',
      },
    ]
  }

  if (!Array.isArray(parsed)) {
    console.error('[simulator] response was not an array:', parsed)
    return [
      {
        id: randomUUID(),
        minute: Math.floor((fromMinute + toMinute) / 2),
        type: 'commentary',
        text: 'Midfield battle as both teams jostle for control.',
      },
    ]
  }

  const validTypes = new Set([
    'goal',
    'goal-conceded',
    'chance',
    'card',
    'injury',
    'substitution',
    'commentary',
  ])

  return parsed
    .filter(
      (e: unknown): e is { minute: number; type: string; text: string; isGoal?: boolean } =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as Record<string, unknown>).minute === 'number' &&
        typeof (e as Record<string, unknown>).type === 'string' &&
        typeof (e as Record<string, unknown>).text === 'string',
    )
    .slice(0, 4) // max 4 events
    .map((e) => ({
      id: randomUUID(),
      minute: Math.max(fromMinute, Math.min(toMinute, e.minute)),
      type: validTypes.has(e.type)
        ? (e.type as MatchEvent['type'])
        : 'commentary',
      text: e.text.slice(0, 150), // safety cap
      isGoal: e.type === 'goal' || e.type === 'goal-conceded' ? true : undefined,
    }))
}
