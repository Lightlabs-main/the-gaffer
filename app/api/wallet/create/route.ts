/**
 * POST /api/wallet/create
 *
 * Logs a user in by email and returns a stable Circle Arc Testnet wallet for
 * that email. The wallet is reused on later logins instead of rotating.
 */
import { NextResponse } from 'next/server'
import { createOrGetWalletForEmail } from '@/lib/wallet-login'

export const dynamic = 'force-dynamic'

interface Body {
  email?: string
}

function detailErr(err: unknown): { stage: string; message: string; details: unknown } {
  const anyErr = err as {
    message?: string
    code?: string | number
    status?: number
    errors?: unknown
    response?: { status?: number; data?: unknown }
  }
  return {
    stage: 'unknown',
    message: anyErr.message ?? String(err),
    details: {
      code: anyErr.code ?? null,
      status: anyErr.status ?? anyErr.response?.status ?? null,
      errors: anyErr.errors ?? null,
      responseData: anyErr.response?.data ?? null,
      keys: Object.keys(anyErr ?? {}),
    },
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const email = body.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ message: 'email is required' }, { status: 400 })
    }

    stage = 'login'
    const result = await createOrGetWalletForEmail(email)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const info = detailErr(err)
    info.stage = stage
    console.error('[wallet/create] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}
