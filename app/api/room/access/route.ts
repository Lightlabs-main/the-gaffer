import { NextResponse } from 'next/server'
import { getSession, persistSession } from '@/lib/session-store'
import { getParticipant } from '@/lib/participant-store'
import { appendProvenance } from '@/lib/provenance'
import { settleDirectUsdcPayment } from '@/lib/settlement'
import { addUsdc } from '@/lib/money'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  participantWalletId?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId || !body.participantWalletId) {
      return NextResponse.json(
        { error: 'sessionId and participantWalletId are required' },
        { status: 400 },
      )
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }
    const participant = getParticipant(session.id, body.participantWalletId)
    if (!participant) {
      return NextResponse.json(
        { error: 'participant wallet not registered for this session' },
        { status: 404 },
      )
    }
    const unlocked = session.matchState.unlockedWallets ?? []
    if (unlocked.includes(participant.walletId)) {
      return NextResponse.json({
        sessionId: session.id,
        unlocked: true,
        alreadyUnlocked: true,
        matchState: session.matchState,
      })
    }

    const amountUsdc = session.matchState.accessPriceUsdc ?? '0.0001'
    stage = 'settle'
    const settlement = await settleDirectUsdcPayment({
      participantWalletId: participant.walletId,
      participantAddress: participant.address,
      payTo: session.matchState.creatorAddress as `0x${string}`,
      amountUsdc,
    })

    stage = 'record-access'
    session.matchState.unlockedWallets = [...unlocked, participant.walletId]
    session.matchState.totalEarned = addUsdc(session.matchState.totalEarned, amountUsdc)
    const settlementMode = 'Circle Arc on-chain transfer'
    appendProvenance(session, {
      category: 'access',
      title: 'Paid access unlocked',
      detail: `${amountUsdc} USDC unlocked "${session.matchState.seedTitle ?? session.matchState.experienceLabel}" via ${settlementMode}.`,
      data: {
        walletId: participant.walletId,
        address: participant.address,
        amountUsdc,
        settlementId: settlement.settle.transaction,
        transactionId: settlement.settle.transactionId,
        txHash: settlement.settle.txHash,
        settlementMode,
        network: settlement.settle.network,
        payer: settlement.settle.payer,
        payTo: settlement.settle.payTo,
        route: settlement.settle.route,
        state: settlement.settle.state,
      },
    })
    persistSession(session)

    return NextResponse.json({
      sessionId: session.id,
      unlocked: true,
      amountUsdc,
      settlement,
      matchState: session.matchState,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[room/access] failed at stage', stage, message)
    return NextResponse.json({ stage, message }, { status: 500 })
  }
}
