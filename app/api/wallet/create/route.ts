/**
 * POST /api/wallet/create
 *
 * Creates a fresh Arc Testnet custodial wallet via Circle and returns the
 * real walletId + address + current on-chain balance.
 *
 * No mocks. No hardcoded values. The balance is read directly from the
 * Arc Testnet USDC contract.
 */
import { NextResponse } from 'next/server'
import { createUserWallet } from '@/lib/circle'
import { readUsdcBalance } from '@/lib/chain'

// Force dynamic — this endpoint mutates external state.
export const dynamic = 'force-dynamic'

function detailErr(err: unknown): { stage: string; message: string; details: unknown } {
  // Circle SDK errors expose: message, code, errors[], status, response.data.
  // Surface everything we can so the failure isn't opaque.
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
      // last-ditch: enumerable keys
      keys: Object.keys(anyErr ?? {}),
    },
  }
}

export async function POST(): Promise<NextResponse> {
  let stage = 'create'
  try {
    const { walletId, address } = await createUserWallet()
    console.log('[wallet/create] created', { walletId, address })

    stage = 'read-balance'
    const balance = await readUsdcBalance(address)
    console.log('[wallet/create] on-chain balance', balance.formatted, 'USDC')

    return NextResponse.json({
      walletId,
      address,
      balance: balance.formatted,
      balanceRaw: balance.raw.toString(),
      chainId: 5042002,
      asset: 'USDC (Arc Testnet)',
      fundingRequired: balance.raw === 0n,
    })
  } catch (err: unknown) {
    const info = detailErr(err)
    info.stage = stage
    console.error('[wallet/create] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}
