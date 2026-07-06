import { getAnthropicClient, managerModel } from './anthropic'
import { env } from './env'

export interface ArticleTrendSource {
  title: string
  url: string
  content: string
}

export interface ArticleTrendDraft {
  title: string
  topic: string
  article: string
  suggestedSteers: string[]
  sources: ArticleTrendSource[]
  agent: {
    name: string
    model: string
    researchService: string
    researchCredits?: number
    researchCostUsdc: string
    requestId?: string | null
    generatedAt: number
  }
}

interface TavilySearchResponse {
  answer?: string
  results?: Array<{
    title?: string
    url?: string
    content?: string
  }>
  usage?: {
    credits?: number
  }
}

export async function generateArticleFromTrend(opts: {
  topic: string
  angle?: string
}): Promise<ArticleTrendDraft> {
  const topic = opts.topic.trim()
  if (!topic) throw new Error('Enter a trend, niche, or story for the agent.')

  const research = await searchTrend(topic)
  const sources = research.sources.slice(0, 5)
  const client = getAnthropicClient()
  const model = managerModel()
  const response = await client.messages.create({
    model,
    max_tokens: 2600,
    system:
      'You are Gaffer Scout, an AI article agent for a paid interactive media platform. You research a trend, draft a creator-ready article, and design prompts readers can pay USDC to steer. Return only valid compact JSON. No markdown.',
    messages: [
      {
        role: 'user',
        content: buildArticlePrompt({
          topic,
          angle: opts.angle?.trim(),
          answer: research.answer,
          sources,
        }),
      },
    ],
  })

  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()
  const parsed = parseDraft(text, topic)

  return {
    ...parsed,
    sources,
    agent: {
      name: 'Gaffer Trend Agent',
      model: response.model,
      researchService: research.usedTavily ? 'Tavily Search' : 'Claude-only fallback',
      researchCredits: research.credits,
      researchCostUsdc: '0.0001',
      requestId: (response as { _request_id?: string | null })._request_id ?? null,
      generatedAt: Date.now(),
    },
  }
}

async function searchTrend(topic: string): Promise<{
  answer?: string
  sources: ArticleTrendSource[]
  credits?: number
  usedTavily: boolean
}> {
  const apiKey = env.optionalTavilyApiKey()
  if (!apiKey) {
    return { sources: [], usedTavily: false }
  }

  const query = `${topic} latest trend creator economy analysis`
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      topic: 'news',
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
      include_usage: true,
      time_range: 'week',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tavily search failed (${res.status}). ${body.slice(0, 160)}`)
  }

  const data = (await res.json()) as TavilySearchResponse
  return {
    answer: data.answer,
    sources: (data.results ?? [])
      .filter((item) => item.title && item.url)
      .map((item) => ({
        title: item.title ?? 'Untitled source',
        url: item.url ?? '',
        content: item.content ?? '',
      })),
    credits: data.usage?.credits,
    usedTavily: true,
  }
}

function buildArticlePrompt(opts: {
  topic: string
  angle?: string
  answer?: string
  sources: ArticleTrendSource[]
}): string {
  const sources = opts.sources
    .map(
      (source, index) =>
        `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.content}`,
    )
    .join('\n\n')

  return [
    `Trend/topic: ${opts.topic}`,
    opts.angle ? `Creator angle: ${opts.angle}` : '',
    opts.answer ? `Search summary: ${opts.answer}` : '',
    sources ? `Research sources:\n${sources}` : 'No external sources were available.',
    '',
    'Write a creator-ready article for Gaffer.',
    'Requirements:',
    '- 650 to 900 words.',
    '- Professional, specific, and useful for readers.',
    '- Do not claim certainty where sources are thin.',
    '- Do not paste source text verbatim.',
    '- End the article with a short "How readers can steer this" paragraph.',
    '- Suggested steers should be things readers can pay to generate: local version, rebuttal, creator playbook, future scenario, or niche-specific version.',
    '',
    'Return JSON exactly like:',
    '{"title":"...","topic":"...","article":"...","suggestedSteers":["...","...","...","..."]}',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseDraft(
  text: string,
  fallbackTopic: string,
): Pick<ArticleTrendDraft, 'title' | 'topic' | 'article' | 'suggestedSteers'> {
  const jsonText = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(jsonText) as {
      title?: string
      topic?: string
      article?: string
      suggestedSteers?: string[]
    }
    return {
      title: parsed.title?.trim() || titleFromTopic(fallbackTopic),
      topic: parsed.topic?.trim() || fallbackTopic,
      article: parsed.article?.trim() || jsonText,
      suggestedSteers: normalizeSteers(parsed.suggestedSteers),
    }
  } catch {
    return {
      title: titleFromTopic(fallbackTopic),
      topic: fallbackTopic,
      article: text,
      suggestedSteers: normalizeSteers([]),
    }
  }
}

function normalizeSteers(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string')
    : []
  return (
    values.length
      ? values
      : [
          'Create a local version for my market',
          'Write the strongest rebuttal',
          'Turn this into a creator playbook',
          'Show the six-month future scenario',
        ]
  ).slice(0, 5)
}

function titleFromTopic(topic: string): string {
  const cleaned = topic.trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'Untitled trend article'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
