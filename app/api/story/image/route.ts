import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_PROMPT_LENGTH = 3500

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim()
  const prompt = request.nextUrl.searchParams.get('prompt')?.trim()
  const requestedSeed = Number(request.nextUrl.searchParams.get('seed') || '1')

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Story image rendering is not configured.' },
      { status: 503 },
    )
  }

  const safePrompt = prompt.slice(0, MAX_PROMPT_LENGTH)
  const stableSeed = Number.isFinite(requestedSeed)
    ? requestedSeed
    : Number.parseInt(createHash('sha256').update(safePrompt).digest('hex').slice(0, 8), 16)
  const model = process.env.POLLINATIONS_IMAGE_MODEL?.trim() || 'flux'
  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(safePrompt)}`)
  url.searchParams.set('model', model)
  url.searchParams.set('width', '768')
  url.searchParams.set('height', '1365')
  url.searchParams.set('seed', String(stableSeed))

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: `Image renderer failed (${response.status})` },
      { status: 502 },
    )
  }

  const image = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  return new NextResponse(image, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, s-maxage=31536000, immutable',
    },
  })
}
