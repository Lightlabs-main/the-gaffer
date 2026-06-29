/**
 * POST /api/wallet/create
 *
 * Creates a fresh Arc Testnet custodial wallet via Circle, requests test USDC
 * from the Circle faucet, polls the chain for the funded balance, and returns
 * the real walletId + address + on-chain balance.
 *
 * No mocks. No hardcoded values. The balance is read directly from the
 * Arc Testnet USDC contract.
 */
import { NextResponse } from 'next/server'
import { createUserWallet, transferUsdcFromTreasury, waitForUsdcBalance } from '@/lib/circle'

// Force dynamic — this endpoint mutates external state.
export const dynamic = 'force-dynamic'

const LOGIN_SEED_USDC = '0.05'

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

    stage = 'fund'
    const { transactionId } = await transferUsdcFromTreasury(address, LOGIN_SEED_USDC)
    console.log('[wallet/create] treasury transfer initiated', { transactionId, to: address })

    stage = 'wait-balance'
    const balance = await waitForUsdcBalance(address)
    console.log('[wallet/create] on-chain balance', balance.formatted, 'USDC')

    return NextResponse.json({
      walletId,
      address,
      balance: balance.formatted,
      balanceRaw: balance.raw.toString(),
      fundingTransactionId: transactionId,
      chainId: 5042002,
      asset: 'USDC (Arc Testnet)',
    })
  } catch (err: unknown) {
    const info = detailErr(err)
    info.stage = stage
    console.error('[wallet/create] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}
