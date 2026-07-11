import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_PROMPT_LENGTH = 1800

export async function GET(request: NextRequest) {
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim()
  const prompt = request.nextUrl.searchParams.get('prompt')?.trim()
  const requestedSeed = Number(request.nextUrl.searchParams.get('seed') || '1')

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  const safePrompt = prompt.slice(0, MAX_PROMPT_LENGTH)
  const stableSeed = Number.isFinite(requestedSeed)
    ? requestedSeed
    : Number.parseInt(createHash('sha256').update(safePrompt).digest('hex').slice(0, 8), 16)
  const model = process.env.POLLINATIONS_IMAGE_MODEL?.trim() || 'flux'
  const cacheKey = createHash('sha256')
    .update(`${model}:${stableSeed}:${safePrompt}`)
    .digest('hex')
  const cacheDirectory =
    process.env.GAFFER_IMAGE_CACHE_DIR?.trim() ||
    path.join(process.cwd(), '.gaffer-data', 'images')
  const cacheFile = path.join(cacheDirectory, `${cacheKey}.jpg`)

  try {
    const cachedImage = await readFile(cacheFile)
    return imageResponse(cachedImage, apiKey ? 'authenticated-cache' : 'demo-cache')
  } catch {
    // A cache miss continues to the image provider.
  }

  const endpoint = apiKey
    ? 'https://gen.pollinations.ai/image/'
    : 'https://image.pollinations.ai/prompt/'
  const url = new URL(`${endpoint}${encodeURIComponent(safePrompt)}`)
  url.searchParams.set('model', model)
  url.searchParams.set('width', '768')
  url.searchParams.set('height', '1365')
  url.searchParams.set('seed', String(stableSeed))
  url.searchParams.set('nologo', 'true')

  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
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
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Image renderer returned an invalid response.' }, { status: 502 })
  }

  const imageBuffer = Buffer.from(image)
  try {
    await mkdir(cacheDirectory, { recursive: true })
    await writeFile(cacheFile, imageBuffer)
  } catch {
    // Rendering still succeeds when a serverless filesystem is read-only.
  }

  return imageResponse(imageBuffer, apiKey ? 'authenticated' : 'demo-fallback', contentType)
}

function imageResponse(
  image: BodyInit,
  provider: string,
  contentType = 'image/jpeg',
) {
  return new NextResponse(image, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, s-maxage=31536000, immutable',
      'X-Gaffer-Image-Provider': provider,
    },
  })
}
