/**
 * AI Manager — the football-manager voice that announces the crowd's call.
 *
 * Input: the closed DecisionWindow + the engine's verdict + the surrounding
 * MatchState (so the manager knows the score, who they're playing, what
 * minute it is).
 * Output: a short speech in a football-manager voice — touchline-grade,
 * concise, *acknowledges the crowd*, *commits to the chosen tactic*.
 *
 * What this file deliberately does NOT do:
 *   - It does not mutate MatchState. Tactic mutations are mechanical
 *     (see lib/tactic-mapping.ts) so the simulator (Phase 7) reads
 *     deterministic state, not LLM whim.
 *   - It does not invent score or events. Only narrates the decision.
 *
 * Anti-fake: a real Claude API call happens; we surface the raw response
 * text and the model id back to the caller for audit.
 */
import { getAnthropicClient, MANAGER_MODEL } from './anthropic'
import type { DecisionWindow, MatchState } from './types'
import type { EngineResult } from './decision-engine'

export interface ManagerVerdict {
  /** What the manager said. Single paragraph, ~2-4 sentences. */
  speech: string
  /** Echoed back for audit — proves which model produced the speech. */
  model: string
  /** Anthropic-side request id, useful when debugging API issues. */
  requestId: string | null
  /** Wall-clock ms the API call took (round-trip). */
  latencyMs: number
}

/**
 * Call Claude to produce the manager speech for a closed decision window.
 */
export async function produceManagerVerdict(opts: {
  matchState: MatchState
  decision: DecisionWindow
  engine: EngineResult
}): Promise<ManagerVerdict> {
  const client = getAnthropicClient()
  const { system, user } = buildPrompt(opts)
  const started = Date.now()
  const response = await client.messages.create({
    model: MANAGER_MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const latencyMs = Date.now() - started

  // The SDK returns content as an array of blocks; we only ever send text
  // and only expect text back, so concatenate text blocks.
  const speech = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('\n')
    .trim()

  if (!speech) {
    throw new Error(
      `Manager produced no text content (stop_reason=${response.stop_reason}, blocks=${response.content.length})`,
    )
  }

  return {
    speech,
    model: response.model,
    requestId: (response as { _request_id?: string | null })._request_id ?? null,
    latencyMs,
  }
}

/**
 * Build the system + user prompts. Kept here (not in a separate file) so a
 * non-coder can see, in one place, exactly what context Claude receives.
 */
function buildPrompt(opts: {
  matchState: MatchState
  decision: DecisionWindow
  engine: EngineResult
}): { system: string; user: string } {
  const { matchState, decision, engine } = opts
  const home = matchState.homeTeam
  const away = matchState.awayTeam

  const confidenceLine = describeConfidence(engine)

  const system = [
    `You are the gaffer (football manager) of ${home.name}, currently playing ${away.name}.`,
    `You manage one team and one team only — the crowd are your bosses; they vote with money during decision windows and you announce the call on the touchline.`,
    `Voice: terse, accent of a working-class British football manager (think Klopp/Ferguson tonality, no caricature). 2 to 4 sentences. No emojis. No markdown. No bullet points.`,
    `You MUST commit to the option the crowd chose — never overrule it, never hedge. You may acknowledge how the vote went (decisive / narrow / divided / last-second reversal).`,
    `Refer to "the crowd" or "the lads in the stands" when acknowledging the call. Refer to the team as "we" / "us".`,
    `Do not invent goals, scores, cards, injuries, substitutions, or minutes that have not happened. Only narrate the decision you have been given.`,
  ].join(' ')

  const optionBreakdown = engine.breakdown
    .map(
      (b) =>
        `  - "${b.label}": ${(b.share * 100).toFixed(1)}% of the money (${b.total.toFixed(6)} USDC)`,
    )
    .join('\n')

  const user = [
    `Match state:`,
    `  Score: ${home.name} ${home.score} - ${away.score} ${away.name}`,
    `  Minute: ${matchState.minute} (${matchState.status})`,
    `  Current shape: ${home.formation}, mentality: ${home.mentality}, press: ${home.pressing}`,
    ``,
    `Decision window just closed (type: ${decision.type}):`,
    `  Prompt to the crowd: "${decision.prompt}"`,
    `  Options the crowd streamed toward:`,
    optionBreakdown,
    ``,
    `Verdict from the money:`,
    `  Winner: "${engine.winnerLabel}"`,
    `  Confidence: ${engine.confidence} (${confidenceLine})`,
    `  Signal note: ${engine.signal}`,
    `  Total streamed this window: ${engine.totalStreamed.toFixed(6)} USDC across ${decision.options.length} options`,
    ``,
    `Now: announce the call to your team on the touchline. Commit to "${engine.winnerLabel}". 2 to 4 sentences. Plain prose, no formatting.`,
  ].join('\n')

  return { system, user }
}

function describeConfidence(engine: EngineResult): string {
  switch (engine.confidence) {
    case 'decisive':
      return `clear winner at ${(engine.winnerShare * 100).toFixed(1)}%`
    case 'narrow':
      return `narrow lead at ${(engine.winnerShare * 100).toFixed(1)}%`
    case 'divided':
      return `crowd split — winner only ${(engine.winnerShare * 100).toFixed(1)}%`
    case 'reversal':
      return `late surge overturned the leader — winner closed at ${(engine.winnerShare * 100).toFixed(1)}%`
  }
}
