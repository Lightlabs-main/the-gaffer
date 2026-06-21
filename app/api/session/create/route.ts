/**
 * POST /api/session/create
 *
 * Creates a fresh match session:
 *   1. Creates a real Circle custodial wallet for the session creator and
 *      funds it with 1 USDC from the treasury (same flow as /api/wallet/create).
 *   2. Builds a starting MatchState (home: "The Crowd FC", away configurable
 *      via body.awayTeamName, default "Algorithm United").
 *   3. Stores the session in the in-memory session store.
 *   4. Returns the session id, creator wallet id+address, and the initial
 *      match state.
 *
 * The session id is what participants use to join via /session/[id].
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createUserWallet, transferUsdcFromTreasury } from '@/lib/circle'
import { waitForUsdcBalance } from '@/lib/circle'
import { setSession } from '@/lib/session-store'
import type { MatchState, Session } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface CreateBody {
  awayTeamName?: string
  homeTeamName?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as CreateBody
    const homeName = body.homeTeamName?.trim() || 'The Crowd FC'
    const awayName = body.awayTeamName?.trim() || 'Algorithm United'

    stage = 'wallet-create'
    const { walletId, address } = await createUserWallet()

    stage = 'wallet-fund'
    const { transactionId } = await transferUsdcFromTreasury(address, '1')

    stage = 'wait-balance'
    const balance = await waitForUsdcBalance(address)

    stage = 'session-build'
    const sessionId = randomUUID()
    const matchState: MatchState = {
      id: sessionId,
      creatorWalletId: walletId,
      creatorAddress: address,
      homeTeam: {
        name: homeName,
        score: 0,
        formation: '4-4-2',
        mentality: 'balanced',
        pressing: 'mid',
      },
      awayTeam: {
        name: awayName,
        score: 0,
        formation: '4-4-2',
      },
      minute: 0,
      status: 'pre-match',
      events: [],
      totalEarned: 0,
    }
    const session: Session = {
      id: sessionId,
      matchState,
      participants: 0,
      createdAt: Date.now(),
      sseClients: new Set(),
    }
    setSession(session)

    console.log('[session/create] created', { sessionId, walletId, address, fundingTransactionId: transactionId })

    return NextResponse.json({
      sessionId,
      creator: {
        walletId,
        address,
        balance: balance.formatted,
        balanceRaw: balance.raw.toString(),
        fundingTransactionId: transactionId,
      },
      matchState,
    })
  } catch (err: unknown) {
    const anyErr = err as { message?: string; code?: string | number; status?: number; response?: { status?: number; data?: unknown } }
    const info = {
      stage,
      message: anyErr.message ?? String(err),
      details: {
        code: anyErr.code ?? null,
        status: anyErr.status ?? anyErr.response?.status ?? null,
        responseData: anyErr.response?.data ?? null,
      },
    }
    console.error('[session/create] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}
