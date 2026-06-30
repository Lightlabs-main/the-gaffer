/**
 * POST /api/session/create
 *
 * Creates a fresh match session:
 *   1. Creates a real Circle custodial wallet for the session creator and
 *      reads its current Arc Testnet USDC balance.
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
import { createUserWallet } from '@/lib/circle'
import { readUsdcBalance } from '@/lib/chain'
import { setSession } from '@/lib/session-store'
import type { MatchState, Session } from '@/lib/types'
import { appendProvenance } from '@/lib/provenance'
import { getExperienceFormat, type ExperienceType } from '@/lib/experience-formats'

export const dynamic = 'force-dynamic'

interface CreateBody {
  awayTeamName?: string
  homeTeamName?: string
  experienceType?: ExperienceType
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as CreateBody
    const format = getExperienceFormat(body.experienceType)
    const homeName = body.homeTeamName?.trim() || format.defaultHome
    const awayName = body.awayTeamName?.trim() || format.defaultAway

    stage = 'wallet-create'
    const { walletId, address } = await createUserWallet()

    stage = 'read-balance'
    const balance = await readUsdcBalance(address)

    stage = 'session-build'
    const sessionId = randomUUID()
    const matchState: MatchState = {
      id: sessionId,
      experienceType: format.id,
      experienceLabel: format.label,
      experienceSummary: format.summary,
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
      provenanceEvents: [],
      sseClients: new Set(),
    }
    appendProvenance(session, {
      category: 'session',
      title: 'Creator experience opened',
      detail: `${format.label}: ${homeName} vs ${awayName} was created with a creator settlement wallet.`,
      data: {
        experienceType: format.id,
        experienceLabel: format.label,
        creatorWalletId: walletId,
        creatorAddress: address,
        balanceRaw: balance.raw.toString(),
      },
    })
    setSession(session)

    console.log('[session/create] created', { sessionId, walletId, address })

    return NextResponse.json({
      sessionId,
      creator: {
        walletId,
        address,
        balance: balance.formatted,
        balanceRaw: balance.raw.toString(),
        fundingRequired: balance.raw === 0n,
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
