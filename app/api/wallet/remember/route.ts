import { NextResponse } from 'next/server'
import type { Address } from 'viem'
import { upsertUserWallet } from '@/lib/user-wallet-store'

export const dynamic = 'force-dynamic'

interface Body {
  email?: string
  walletId?: string
  address?: string
  balance?: string
  balanceRaw?: string
  fundingTransactionId?: string
  fundingWarning?: string
  chainId?: number
  asset?: string
  createdAt?: number
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Body
  const email = body.email?.trim().toLowerCase()
  if (!email || !body.walletId || !body.address) {
    return NextResponse.json(
      { error: 'email, walletId and address are required' },
      { status: 400 },
    )
  }

  const wallet = upsertUserWallet({
    email,
    walletId: body.walletId,
    address: body.address as Address,
    balance: body.balance,
    balanceRaw: body.balanceRaw,
    fundingTransactionId: body.fundingTransactionId,
    fundingWarning: body.fundingWarning,
    chainId: body.chainId ?? 5042002,
    asset: body.asset ?? 'USDC (Arc Testnet)',
    createdAt: body.createdAt,
  })

  return NextResponse.json({ wallet })
}
