import { NextResponse } from 'next/server'
import { getSession, persistSession } from '@/lib/session-store'
import { getParticipant } from '@/lib/participant-store'
import { appendProvenance } from '@/lib/provenance'
import { settleDirectUsdcPayment } from '@/lib/settlement'
import { generateMediaBranch } from '@/lib/media-director'
import { addUsdc } from '@/lib/money'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  participantWalletId?: string
  prompt?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId || !body.participantWalletId || !body.prompt?.trim()) {
      return NextResponse.json(
        { error: 'sessionId, participantWalletId and prompt are required' },
        { status: 400 },
      )
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }
    if (session.matchState.roomKind === 'football') {
      return NextResponse.json(
        { error: 'football sessions use decision windows, not media branches' },
        { status: 400 },
      )
    }
    const participant = getParticipant(session.id, body.participantWalletId)
    if (!participant) {
      return NextResponse.json(
        { error: 'participant wallet not registered for this session' },
        { status: 404 },
      )
    }

    const unlocked = session.matchState.unlockedWallets ?? []
    if (!unlocked.includes(participant.walletId)) {
      return NextResponse.json(
        { error: 'unlock this room before steering a branch' },
        { status: 402 },
      )
    }

    const amountUsdc = session.matchState.steerPriceUsdc ?? '0.0001'
    stage = 'settle'
    const settlement = await settleDirectUsdcPayment({
      participantWalletId: participant.walletId,
      participantAddress: participant.address,
      payTo: session.matchState.creatorAddress as `0x${string}`,
      amountUsdc,
    })

    stage = 'generate'
    const branch = await generateMediaBranch({
      matchState: session.matchState,
      walletId: participant.walletId,
      address: participant.address,
      prompt: body.prompt.trim(),
      amountUsdc,
      settlementId: settlement.settle.transaction,
    })

    stage = 'record-branch'
    session.matchState.branches = [branch, ...(session.matchState.branches ?? [])].slice(0, 20)
    session.matchState.totalEarned = addUsdc(session.matchState.totalEarned, amountUsdc)
    const settlementMode = 'Circle Arc on-chain transfer'
    appendProvenance(session, {
      category: 'branch',
      title: 'Paid branch generated',
      detail: `${amountUsdc} USDC generated "${branch.title}" via ${settlementMode}.`,
      data: {
        branchId: branch.id,
        kind: branch.kind,
        prompt: branch.prompt,
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
        model: branch.model,
        requestId: branch.requestId,
      },
    })
    persistSession(session)

    return NextResponse.json({
      sessionId: session.id,
      amountUsdc,
      settlement,
      branch,
      matchState: session.matchState,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[room/branch] failed at stage', stage, message)
    return NextResponse.json({ stage, message }, { status: 500 })
  }
}
