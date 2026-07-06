import { randomUUID } from 'node:crypto'
import { getAnthropicClient, managerModel } from './anthropic'
import type { MatchState, MediaBranch } from './types'

export async function generateMediaBranch(opts: {
  matchState: MatchState
  walletId: string
  address: string
  prompt: string
  amountUsdc: string
  settlementId?: string
}): Promise<MediaBranch> {
  const client = getAnthropicClient()
  const model = managerModel()
  const started = Date.now()
  const kind = branchKind(opts.matchState.roomKind)
  const response = await client.messages.create({
    model,
    max_tokens: 1800,
    system: buildSystemPrompt(opts.matchState.roomKind),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(opts.matchState, opts.prompt),
      },
    ],
  })
  const latencyMs = Date.now() - started
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()
  const parsed = parseBranchJson(text)

  return {
    id: randomUUID(),
    walletId: opts.walletId,
    address: opts.address,
    prompt: opts.prompt,
    kind,
    title: parsed.title,
    summary: parsed.summary,
    body: parsed.body,
    scenes: kind === 'storyboard-video' ? parsed.scenes : undefined,
    amountUsdc: opts.amountUsdc,
    settlementId: opts.settlementId,
    createdAt: Date.now(),
    model: response.model,
    requestId: (response as { _request_id?: string | null })._request_id ?? null,
    latencyMs,
  }
}

function branchKind(roomKind: MatchState['roomKind']): MediaBranch['kind'] {
  if (roomKind === 'live-video') return 'video-director'
  if (roomKind === 'story-video') return 'storyboard-video'
  return 'article-branch'
}

function buildSystemPrompt(roomKind: MatchState['roomKind']): string {
  const base =
    'You are Gaffer, an AI director for paid interactive media. The user paid USDC to steer a creator seed. Generate only valid JSON with keys title, summary, body, scenes. No markdown.'
  if (roomKind === 'live-video') {
    return `${base} For live video, body should be a short creator-facing director cue: what to say, ask, or do next. scenes should be an empty array.`
  }
  if (roomKind === 'story-video') {
    return `${base} For story video, create a storyboard-video branch. Include 4 scenes, each with title, visual, caption. Body should be a 45-second narration script. Keep the JSON compact.`
  }
  return `${base} For article/story, write a strong alternate branch or angle. Body should be 350-500 words. scenes should be an empty array. Keep the JSON compact.`
}

function buildUserPrompt(matchState: MatchState, prompt: string): string {
  return [
    `Room: ${matchState.experienceLabel}`,
    `Seed title: ${matchState.seedTitle ?? matchState.homeTeam.name}`,
    `Seed topic: ${matchState.seedTopic ?? matchState.awayTeam.name}`,
    `Creator seed:`,
    matchState.seedContent ?? matchState.experienceSummary,
    ``,
    `Paid steer from audience/user: ${prompt}`,
    ``,
    `Return JSON exactly like:`,
    `{"title":"...","summary":"...","body":"...","scenes":[{"title":"...","visual":"...","caption":"..."}]}`,
  ].join('\n')
}

function parseBranchJson(text: string): {
  title: string
  summary: string
  body: string
  scenes: { title: string; visual: string; caption: string }[]
} {
  const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(jsonText) as {
      title?: string
      summary?: string
      body?: string
      scenes?: { title?: string; visual?: string; caption?: string }[]
    }
    return {
      title: parsed.title || 'Untitled branch',
      summary: parsed.summary || 'A paid audience branch was generated.',
      body: parsed.body || jsonText,
      scenes: (parsed.scenes ?? []).slice(0, 6).map((scene, index) => ({
        title: scene.title || `Scene ${index + 1}`,
        visual: scene.visual || 'A cinematic story frame',
        caption: scene.caption || '',
      })),
    }
  } catch {
    const recoveredTitle = extractJsonStringField(jsonText, 'title')
    const recoveredSummary = extractJsonStringField(jsonText, 'summary')
    const recoveredBody = extractJsonStringField(jsonText, 'body')
    return {
      title: recoveredTitle || titleFromPrompt(text),
      summary: recoveredSummary || text.slice(0, 160),
      body: recoveredBody || text,
      scenes: [],
    }
  }
}

function extractJsonStringField(text: string, field: string): string | null {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`, 's')
  const match = text.match(pattern)
  if (!match?.[1]) return null
  const raw = match[1]
    .replace(/",\s*"[a-zA-Z]+[\s\S]*$/s, '')
    .replace(/"\s*}\s*$/s, '')
  try {
    return JSON.parse(`"${raw.replace(/"$/, '')}"`) as string
  } catch {
    return raw
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim()
  }
}

function titleFromPrompt(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8)
  if (!firstLine) return 'Audience branch'
  return firstLine
    .replace(/^["'{\s]+/, '')
    .replace(/["',\s]+$/, '')
    .slice(0, 90)
}
