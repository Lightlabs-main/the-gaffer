/**
 * POST /api/wallet/participant
 *
 * Body: { sessionId: string, walletId?: string, address?: string,
 *         prepareGateway?: boolean, gatewayUsdc?: string }
 *
 * Registers a joiner's wallet for a match session.
 *
 *   1. Uses the signed-up Circle wallet passed by the browser, or creates a
 *      fresh Circle developer-controlled wallet if none exists yet.
 *   2. Reads the wallet's real Arc Testnet USDC balance.
 *   3. If `prepareGateway` is true, approves and deposits `gatewayUsdc`
 *      into Circle Gateway so the wallet can stream x402 taps.
 *   4. Records the wallet in the per-session participant registry so
 *      /api/decision/stream can look it up by walletId.
 *
 * No treasury transfer happens here. Users fund their own wallet, then prepare
 * Gateway from that funded wallet.
 */
import { NextResponse } from 'next/server'
import { getAddress, type Address } from 'viem'
import { getSession, persistSession } from '@/lib/session-store'
import { createUserWallet } from '@/lib/circle'
import { readUsdcBalance } from '@/lib/chain'
import { depositForParticipant, readGatewayAvailableBalance } from '@/lib/gateway'
import { addParticipant, getParticipant } from '@/lib/participant-store'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  walletId?: string
  address?: string
  prepareGateway?: boolean
  gatewayUsdc?: string // decimal e.g. "0.05"
}

const PARTICIPANT_GATEWAY_USDC = '0.05'

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'session not found', sessionId: body.sessionId },
        { status: 404 },
      )
    }
    const gatewayUsdc = body.gatewayUsdc ?? PARTICIPANT_GATEWAY_USDC

    stage = 'wallet-create'
    const wallet =
      body.walletId && body.address
        ? {
            walletId: body.walletId,
            address: getAddress(body.address) as Address,
          }
        : await createUserWallet()

    stage = 'read-wallet-balance'
    const onChainBalance = await readUsdcBalance(wallet.address)
    let approveTransactionId: string | undefined
    let depositTransactionId: string | undefined
    let gatewayDepositedUsdc: string | undefined
    let gatewayBalance = await readGatewayAvailableBalance(wallet.address)

    if (body.prepareGateway) {
      stage = 'gateway-deposit'
      const deposit = await depositForParticipant({
        walletId: wallet.walletId,
        walletAddress: wallet.address,
        amountUsdc: gatewayUsdc,
      })
      approveTransactionId = deposit.approveTransactionId
      depositTransactionId = deposit.depositTransactionId
      gatewayDepositedUsdc = gatewayUsdc

      stage = 'wait-gateway-balance'
      gatewayBalance = await waitForGatewayBalance({
        depositor: wallet.address,
        atLeastAtomic: BigInt(deposit.amountAtomic),
      })
    }

    stage = 'store-participant'
    const existingParticipant = getParticipant(session.id, wallet.walletId)
    addParticipant(session.id, {
      walletId: wallet.walletId,
      address: wallet.address,
      gatewayDepositedUsdc: gatewayDepositedUsdc ?? existingParticipant?.gatewayDepositedUsdc,
      approveTransactionId: approveTransactionId ?? existingParticipant?.approveTransactionId,
      depositTransactionId: depositTransactionId ?? existingParticipant?.depositTransactionId,
      createdAt: existingParticipant?.createdAt ?? Date.now(),
    })
    if (!existingParticipant) session.participants += 1
    persistSession(session)

    return NextResponse.json({
      sessionId: session.id,
      participant: {
        walletId: wallet.walletId,
        address: wallet.address,
        gatewayDepositedUsdc,
        balanceOnChain: onChainBalance.formatted,
        balanceOnChainRaw: onChainBalance.raw.toString(),
        gatewayAvailable: gatewayBalance.formatted,
        gatewayAvailableRaw: gatewayBalance.raw.toString(),
        gatewayReady: gatewayBalance.raw > 0n,
        fundingRequired: onChainBalance.raw === 0n,
        approveTransactionId,
        depositTransactionId,
      },
      participants: session.participants,
    })
  } catch (err: unknown) {
    const anyErr = err as {
      message?: string
      code?: string | number
      status?: number
      response?: { status?: number; data?: unknown }
    }
    const info = {
      stage,
      message: anyErr.message ?? String(err),
      details: {
        code: anyErr.code ?? null,
        status: anyErr.status ?? anyErr.response?.status ?? null,
        responseData: anyErr.response?.data ?? null,
      },
    }
    console.error('[wallet/participant] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}

async function waitForGatewayBalance(opts: {
  depositor: Address
  atLeastAtomic: bigint
  timeoutMs?: number
  intervalMs?: number
}): Promise<{ raw: bigint; formatted: string }> {
  const timeoutMs = opts.timeoutMs ?? 120_000
  const intervalMs = opts.intervalMs ?? 3_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const bal = await readGatewayAvailableBalance(opts.depositor)
    if (bal.raw >= opts.atLeastAtomic) return bal
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return readGatewayAvailableBalance(opts.depositor)
}
