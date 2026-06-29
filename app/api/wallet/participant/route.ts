/**
 * POST /api/wallet/participant
 *
 * Body: { sessionId: string, treasuryUsdc?: string, gatewayUsdc?: string }
 *
 * One call that does everything a new joiner needs to be able to stream
 * USDC inside a match session:
 *
 *   1. Creates a fresh Circle developer-controlled wallet on Arc Testnet.
 *   2. Sends `treasuryUsdc` USDC from the project treasury to that wallet
 *      (default 0.05).
 *   3. Waits for the on-chain balance to land (poll Arc Testnet USDC contract).
 *   4. Approves the Circle GatewayWallet contract to spend `gatewayUsdc`
 *      USDC of that wallet, then calls `depositFor(usdc, depositor, amount)`
 *      against GatewayWallet (default 0.03 USDC).
 *   5. Records the wallet in the per-session participant registry so
 *      /api/decision/stream can look it up by walletId.
 *
 * Returns the wallet id + address + on-chain balance + Gateway balance, so
 * the caller can prove every step happened against real chain state.
 *
 * Cost note: Arc Testnet charges gas in USDC, so the treasury seed has to
 * cover both the deposit amount and the gas for approve+deposit. The demo
 * seed is intentionally small so the testnet treasury survives repeated joins.
 */
import { NextResponse } from 'next/server'
import type { Address } from 'viem'
import { getSession, persistSession } from '@/lib/session-store'
import {
  createUserWallet,
  transferUsdcFromTreasury,
  waitForUsdcBalance,
} from '@/lib/circle'
import { depositForParticipant, readGatewayAvailableBalance } from '@/lib/gateway'
import { addParticipant } from '@/lib/participant-store'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  treasuryUsdc?: string // decimal e.g. "0.05"
  gatewayUsdc?: string // decimal e.g. "0.03"
}

const PARTICIPANT_SEED_USDC = '0.05'
const PARTICIPANT_GATEWAY_USDC = '0.03'

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
    const treasuryUsdc = body.treasuryUsdc ?? PARTICIPANT_SEED_USDC
    const gatewayUsdc = body.gatewayUsdc ?? PARTICIPANT_GATEWAY_USDC

    stage = 'wallet-create'
    const { walletId, address } = await createUserWallet()

    stage = 'treasury-transfer'
    const { transactionId: treasuryTxId } = await transferUsdcFromTreasury(
      address,
      treasuryUsdc,
    )

    stage = 'wait-treasury-balance'
    const treasuryBalance = await waitForUsdcBalance(address)

    stage = 'gateway-deposit'
    const { approveTransactionId, depositTransactionId, amountAtomic } =
      await depositForParticipant({
        walletId,
        walletAddress: address,
        amountUsdc: gatewayUsdc,
      })

    stage = 'wait-gateway-balance'
    const gatewayBalance = await waitForGatewayBalance({
      depositor: address,
      atLeastAtomic: BigInt(amountAtomic),
    })

    stage = 'store-participant'
    addParticipant(session.id, {
      walletId,
      address,
      treasuryFundedUsdc: treasuryUsdc,
      gatewayDepositedUsdc: gatewayUsdc,
      approveTransactionId,
      depositTransactionId,
      createdAt: Date.now(),
    })
    session.participants += 1
    persistSession(session)

    return NextResponse.json({
      sessionId: session.id,
      participant: {
        walletId,
        address,
        treasuryFundedUsdc: treasuryUsdc,
        gatewayDepositedUsdc: gatewayUsdc,
        balanceOnChain: treasuryBalance.formatted,
        balanceOnChainRaw: treasuryBalance.raw.toString(),
        gatewayAvailable: gatewayBalance.formatted,
        gatewayAvailableRaw: gatewayBalance.raw.toString(),
        treasuryTransactionId: treasuryTxId,
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
