import { NextResponse } from 'next/server'
import { generateArticleFromTrend } from '@/lib/article-trend-agent'

export const dynamic = 'force-dynamic'

interface TrendBody {
  topic?: string
  angle?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as TrendBody
    const draft = await generateArticleFromTrend({
      topic: body.topic ?? '',
      angle: body.angle,
    })
    return NextResponse.json(draft)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate article'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
