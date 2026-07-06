import { NextResponse } from 'next/server'
import { getAddress, parseUnits, type Address } from 'viem'
import {
  readGatewayAvailableBalance,
  withdrawGatewayAvailableBalance,
} from '@/lib/gateway'
import { getSession } from '@/lib/session-store'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  creatorWalletId?: string
  amountUsdc?: string
  maxFeeUsdc?: string
  destinationAddress?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId || !body.creatorWalletId || !body.amountUsdc || !body.destinationAddress) {
      return NextResponse.json(
        {
          error:
            'sessionId, creatorWalletId, amountUsdc and destinationAddress are required',
        },
        { status: 400 },
      )
    }

    const session = await getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }
    if (session.matchState.creatorWalletId !== body.creatorWalletId) {
      return NextResponse.json(
        { error: 'creatorWalletId does not own this session' },
        { status: 403 },
      )
    }

    let destination: Address
    try {
      destination = getAddress(body.destinationAddress) as Address
    } catch {
      return NextResponse.json({ error: 'destinationAddress is not a valid EVM address' }, { status: 400 })
    }

    const amountAtomic = parseUnits(body.amountUsdc, 6)
    if (amountAtomic <= 0n) {
      return NextResponse.json({ error: 'amountUsdc must be greater than zero' }, { status: 400 })
    }

    const gatewayBalance = await readGatewayAvailableBalance(
      session.matchState.creatorAddress as Address,
    )
    if (gatewayBalance.raw < amountAtomic) {
      return NextResponse.json(
        {
          error: 'insufficient creator Gateway earnings',
          requestedAtomic: amountAtomic.toString(),
          gatewayAvailableRaw: gatewayBalance.raw.toString(),
          gatewayAvailable: gatewayBalance.formatted,
        },
        { status: 409 },
      )
    }

    const withdrawal = await withdrawGatewayAvailableBalance({
      creatorWalletId: body.creatorWalletId,
      creatorAddress: session.matchState.creatorAddress as Address,
      recipientAddress: destination,
      amountUsdc: body.amountUsdc,
      maxFeeUsdc: body.maxFeeUsdc,
    })

    return NextResponse.json({
      sessionId: session.id,
      creatorAddress: session.matchState.creatorAddress,
      destinationAddress: destination,
      requestedAmountUsdc: body.amountUsdc,
      amountAtomic: withdrawal.amountAtomic,
      gatewayAvailableBefore: gatewayBalance.formatted,
      gatewayAvailableBeforeRaw: gatewayBalance.raw.toString(),
      transactionId: withdrawal.mintTransactionId,
      mintTransactionId: withdrawal.mintTransactionId,
      gateway: {
        attestation: withdrawal.attestation,
        signature: withdrawal.gatewaySignature,
        burnIntentSignature: withdrawal.burnIntentSignature,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wallet/withdraw] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
