import { NextResponse } from 'next/server'
import { getAddress, parseUnits, type Address } from 'viem'
import {
  readGatewayAvailableBalance,
  withdrawGatewayAvailableBalance,
} from '@/lib/gateway'

export const dynamic = 'force-dynamic'

interface Body {
  walletId?: string
  address?: string
  amountUsdc?: string
  destinationAddress?: string
  maxFeeUsdc?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.walletId || !body.address || !body.amountUsdc) {
      return NextResponse.json(
        { error: 'walletId, address and amountUsdc are required' },
        { status: 400 },
      )
    }

    let walletAddress: Address
    let destinationAddress: Address
    try {
      walletAddress = getAddress(body.address) as Address
      destinationAddress = getAddress(body.destinationAddress || body.address) as Address
    } catch {
      return NextResponse.json({ error: 'address is not a valid EVM address' }, { status: 400 })
    }

    const amountAtomic = parseUnits(body.amountUsdc, 6)
    if (amountAtomic <= 0n) {
      return NextResponse.json({ error: 'amountUsdc must be greater than zero' }, { status: 400 })
    }

    const gatewayBalance = await readGatewayAvailableBalance(walletAddress)
    if (gatewayBalance.raw < amountAtomic) {
      return NextResponse.json(
        {
          error: 'insufficient Gateway balance',
          requestedAtomic: amountAtomic.toString(),
          gatewayAvailableRaw: gatewayBalance.raw.toString(),
          gatewayAvailable: gatewayBalance.formatted,
        },
        { status: 409 },
      )
    }

    const withdrawal = await withdrawGatewayAvailableBalance({
      creatorWalletId: body.walletId,
      creatorAddress: walletAddress,
      recipientAddress: destinationAddress,
      amountUsdc: body.amountUsdc,
      maxFeeUsdc: body.maxFeeUsdc,
    })

    return NextResponse.json({
      walletId: body.walletId,
      address: walletAddress,
      destinationAddress,
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
    console.error('[wallet/gateway/withdraw] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
