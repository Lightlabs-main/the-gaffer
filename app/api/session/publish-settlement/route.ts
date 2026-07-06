import { NextResponse } from 'next/server'
import { getSession, persistSession } from '@/lib/session-store'
import { appendProvenance } from '@/lib/provenance'
import { addUsdc } from '@/lib/money'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  txHash?: string
  payerAddress?: string
  amountUsdc?: string
  purpose?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId || !body.txHash || !body.payerAddress) {
      return NextResponse.json(
        { error: 'sessionId, txHash, and payerAddress are required' },
        { status: 400 },
      )
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
      return NextResponse.json({ error: 'invalid txHash' }, { status: 400 })
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.payerAddress)) {
      return NextResponse.json({ error: 'invalid payerAddress' }, { status: 400 })
    }

    const session = await getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }

    const amountUsdc = body.amountUsdc?.trim() || session.matchState.accessPriceUsdc || '0.0001'
    session.matchState.totalEarned = addUsdc(session.matchState.totalEarned, amountUsdc)

    const event = appendProvenance(session, {
      category: 'wallet',
      title: 'Creator signed Arc activation',
      detail: `${amountUsdc} USDC was signed by the creator wallet to activate "${session.matchState.seedTitle ?? session.matchState.experienceLabel}".`,
      data: {
        amountUsdc,
        payerAddress: body.payerAddress,
        payTo: session.matchState.creatorAddress,
        purpose: body.purpose ?? 'creator-room-activation',
        txHash: body.txHash,
      },
    })
    await persistSession(session)

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      event,
      matchState: session.matchState,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[session/publish-settlement] failed', message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
