import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const runtime = 'nodejs'

const MAX_PROMPT_LENGTH = 1800
const FAL_MODEL = 'fal-ai/flux/schnell'

export async function GET(request: NextRequest) {
  const falKey = env.optionalFalKey()?.trim()
  const apiKey = process.env.POLLINATIONS_API_KEY?.trim()
  const prompt = request.nextUrl.searchParams.get('prompt')?.trim()
  const requestedSeed = Number(request.nextUrl.searchParams.get('seed') || '1')

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  const safePrompt = prompt.slice(0, MAX_PROMPT_LENGTH)
  const cinematicPrompt = [
    safePrompt,
    'vertical cinematic anime movie frame, connected story scene, expressive character acting, high detail, dramatic lighting, professional composition, no text, no subtitles, no UI, no watermark',
  ].join(', ')
  const stableSeed = Number.isFinite(requestedSeed)
    ? requestedSeed
    : Number.parseInt(createHash('sha256').update(safePrompt).digest('hex').slice(0, 8), 16)
  const model = falKey
    ? `${FAL_MODEL}:portrait_16_9`
    : process.env.POLLINATIONS_IMAGE_MODEL?.trim() || 'flux'
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

  if (falKey) {
    try {
      const falImage = await renderWithFal({
        apiKey: falKey,
        prompt: cinematicPrompt,
        seed: stableSeed,
      })
      try {
        await mkdir(cacheDirectory, { recursive: true })
        await writeFile(cacheFile, falImage.image)
      } catch {
        // Rendering still succeeds when a serverless filesystem is read-only.
      }
      return imageResponse(falImage.image, 'fal-cacheable', falImage.contentType)
    } catch (error) {
      console.warn('[story-image] fal render failed; trying fallback provider', error)
    }
  }

  const endpoint = apiKey
    ? 'https://gen.pollinations.ai/image/'
    : 'https://image.pollinations.ai/prompt/'
  const url = new URL(`${endpoint}${encodeURIComponent(cinematicPrompt)}`)
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

async function renderWithFal({
  apiKey,
  prompt,
  seed,
}: {
  apiKey: string
  prompt: string
  seed: number
}) {
  const response = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'portrait_16_9',
      num_images: 1,
      seed,
      enable_safety_checker: true,
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`fal failed (${response.status}): ${text.slice(0, 240)}`)
  }

  const data = (await response.json()) as {
    images?: Array<{ url?: string; content_type?: string }>
  }
  const imageUrl = data.images?.[0]?.url
  if (!imageUrl) throw new Error('fal returned no image url')

  const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(120_000) })
  if (!imageResponse.ok) {
    throw new Error(`fal image download failed (${imageResponse.status})`)
  }
  const contentType = imageResponse.headers.get('content-type') || data.images?.[0]?.content_type || 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error(`fal returned invalid image content type: ${contentType}`)
  }

  return {
    contentType,
    image: Buffer.from(await imageResponse.arrayBuffer()),
  }
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
