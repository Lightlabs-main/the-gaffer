import { NextResponse } from 'next/server'

function sameHostUrl(req: Request, path: string): URL {
  const requestUrl = new URL(req.url)
  const host = req.headers.get('host') ?? requestUrl.host
  const protocol =
    req.headers.get('x-forwarded-proto') ?? requestUrl.protocol.replace(':', '')
  return new URL(path, `${protocol}://${host}`)
}

export async function POST(req: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(sameHostUrl(req, '/profile'), {
    status: 303,
  })
  response.cookies.set('gaffer_profile_identity', '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
  })
  return response
}
