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
    max_tokens: kind === 'storyboard-video' ? 4800 : 1800,
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
    scenes:
      kind === 'storyboard-video'
        ? ensureStoryboardScenes(parsed.scenes, parsed.body, parsed.title, parsed.summary)
        : undefined,
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
    return `${base}

For story video, you are an award-winning filmmaker, novelist, storyboard artist, and AI visual director.

Your job is to create a complete cinematic image-story series that feels like a movie told through pictures.
Do not create random images. Build a connected emotional story where every image continues from the previous one.

The creator seed and paid steer are the user's idea. If genre, visual style, or chapter count are not explicit, infer them from the seed and steer. Default to 3 chapters and exactly 6 image scenes total.

Return valid compact JSON only:
{
  "title": "Powerful memorable story title",
  "summary": "Short overview explaining the main conflict, emotions, and journey",
  "body": "Structured story bible with sections: STORY TITLE, STORY OVERVIEW, MAIN CHARACTERS, STORY STRUCTURE. Character profiles must include name, age, personality, background, facial features, hair style, body type, clothing style, and unique details. Chapter notes must include chapter title, what happens, and emotional purpose.",
  "scenes": [
    {
      "sceneNumber": 1,
      "chapterTitle": "Chapter 1 - ...",
      "title": "Scene 1 - ...",
      "caption": "NARRATION: exact emotional narrator text that appears with this image",
      "visual": "VISUAL DESCRIPTION: character actions, facial expressions, emotions, location, background details, important objects, and atmosphere",
      "imagePrompt": "IMAGE GENERATION PROMPT: repeat character consistency details, clothing, facial features, pose, camera angle, cinematic lighting, realistic environment or requested style, mood, movie-quality composition"
    }
  ]
}

Rules:
- Every scene must connect smoothly to the previous scene.
- Characters must remain visually identical across every chapter and every image. Repeat consistency details in every imagePrompt.
- Every image must reveal emotion, conflict, mystery, or progress.
- Avoid boring scenes and random changes.
- Make it feel like a premium cinematic visual story series.
- Keep body under 700 words.
- Return exactly 6 scenes. Do not return an empty scenes array.
- Make every imagePrompt self-contained and directly usable by an image model.`
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
    `{"title":"...","summary":"...","body":"...","scenes":[{"sceneNumber":1,"chapterTitle":"...","title":"...","caption":"...","visual":"...","imagePrompt":"..."}]}`,
  ].join('\n')
}

function parseBranchJson(text: string): {
  title: string
  summary: string
  body: string
  scenes: NonNullable<MediaBranch['scenes']>
} {
  const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(jsonText) as {
      title?: string
      summary?: string
      body?: string
      scenes?: {
        sceneNumber?: number | string
        chapterTitle?: string
        title?: string
        visual?: string
        visualDescription?: string
        caption?: string
        narration?: string
        imagePrompt?: string
      }[]
    }
    return {
      title: parsed.title || 'Untitled branch',
      summary: parsed.summary || 'A paid audience branch was generated.',
      body: parsed.body || jsonText,
      scenes: (parsed.scenes ?? []).slice(0, 10).map((scene, index) => ({
        sceneNumber: scene.sceneNumber ?? index + 1,
        chapterTitle: scene.chapterTitle,
        title: scene.title || `Scene ${index + 1}`,
        visual:
          scene.visualDescription ||
          scene.visual ||
          'A cinematic story frame',
        caption: scene.narration || scene.caption || '',
        narration: scene.narration || scene.caption || '',
        visualDescription: scene.visualDescription || scene.visual || '',
        imagePrompt: scene.imagePrompt || '',
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

function ensureStoryboardScenes(
  scenes: NonNullable<MediaBranch['scenes']>,
  body: string,
  title: string,
  summary: string,
): NonNullable<MediaBranch['scenes']> {
  if (scenes.length) return scenes

  const chapters = Array.from(
    body.matchAll(
      /^Chapter\s+(\d+)\s*[-\u2013\u2014]\s*([^:\n]+):\s*(.+)$/gim,
    ),
  )

  const characterBible =
    body.match(/MAIN CHARACTERS:\s*([\s\S]*?)(?:\n\s*STORY STRUCTURE:|$)/i)?.[1]?.trim() ||
    'Keep the lead characters visually identical in every frame.'

  const beats = chapters.length
    ? chapters.flatMap((chapter) => {
        const chapterNumber = Number(chapter[1])
        const chapterTitle = chapter[2].trim()
        const detail = chapter[3].trim()
        const [action, emotion = 'The emotional stakes deepen.'] = detail.split(
          /\s*Emotional purpose:\s*/i,
        )
        return [
          {
            sceneNumber: (chapterNumber - 1) * 2 + 1,
            chapterTitle: `Chapter ${chapterNumber} - ${chapterTitle}`,
            title: `${chapterTitle}: opening image`,
            caption: action,
            visual: `${action} Establish the location, relationship, and visual motif with a strong cinematic composition.`,
            emotion,
          },
          {
            sceneNumber: (chapterNumber - 1) * 2 + 2,
            chapterTitle: `Chapter ${chapterNumber} - ${chapterTitle}`,
            title: `${chapterTitle}: turning point`,
            caption: `${emotion} The characters make a choice that carries the story into the next scene.`,
            visual: `${emotion} Show a decisive emotional close-up and a clear change in the relationship.`,
            emotion,
          },
        ]
      })
    : Array.from({ length: 6 }, (_, index) => ({
        sceneNumber: index + 1,
        chapterTitle: `Chapter ${Math.floor(index / 2) + 1}`,
        title: index === 5 ? 'The final choice' : `Story beat ${index + 1}`,
        caption: index === 0 ? summary : `${summary} The story advances toward its next emotional turn.`,
        visual: `A connected cinematic frame from ${title}, continuing directly from the previous moment.`,
        emotion: 'Emotion, conflict, mystery, and visible narrative progress.',
      }))

  return beats.slice(0, 6).map((beat) => {
    const visualDescription = beat.visual
    return {
      sceneNumber: beat.sceneNumber,
      chapterTitle: beat.chapterTitle,
      title: beat.title,
      caption: beat.caption,
      narration: beat.caption,
      visual: visualDescription,
      visualDescription,
      imagePrompt: [
        'Vertical 9:16 high-budget cinematic story frame, no text, no captions, no watermark.',
        `Story: ${title}.`,
        `Character consistency bible: ${characterBible}`,
        `Scene: ${visualDescription}`,
        `Mood: ${beat.emotion}`,
        'Natural expressive faces, coherent anatomy, dramatic cinematic lighting, professional composition, detailed environment.',
      ].join(' '),
    }
  })
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
