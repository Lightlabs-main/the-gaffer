import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function sameHostUrl(req: Request, path: string): URL {
  const requestUrl = new URL(req.url)
  const host = req.headers.get('host') ?? requestUrl.host
  const protocol =
    req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  return new URL(path, `${protocol}://${host}`)
}

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData()
  const nextPath = String(form.get('next') ?? '/profile')
  const redirectUrl = sameHostUrl(
    req,
    nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/profile',
  )

  redirectUrl.searchParams.set('login', 'dynamic_required')
  return NextResponse.redirect(redirectUrl, { status: 303 })
}
