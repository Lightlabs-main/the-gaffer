/**
 * POST /api/session/create
 *
 * Creates a fresh room attached to the creator's signed-in Circle Arc wallet.
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { isAddress, type Address } from 'viem'
import { readUsdcBalance } from '@/lib/chain'
import { setSession } from '@/lib/session-store'
import type { MatchState, Session } from '@/lib/types'
import { appendProvenance } from '@/lib/provenance'
import { getExperienceFormat, type ExperienceType } from '@/lib/experience-formats'
import { createDailyRoom } from '@/lib/daily'

export const dynamic = 'force-dynamic'

interface CreateBody {
  awayTeamName?: string
  homeTeamName?: string
  experienceType?: ExperienceType
  seedContent?: string
  dailyRoomUrl?: string
  accessPriceUsdc?: string
  steerPriceUsdc?: string
  creatorEmail?: string
  creatorWalletId?: string
  creatorAddress?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as CreateBody
    const format = getExperienceFormat(body.experienceType)
    const homeName = body.homeTeamName?.trim() || format.defaultHome
    const awayName = body.awayTeamName?.trim() || format.defaultAway
    const pastedSeedContent = body.seedContent?.trim()
    if (format.roomKind === 'article' && !pastedSeedContent) {
      return NextResponse.json(
        { error: 'Paste the article body before launching an article room.' },
        { status: 400 },
      )
    }
    const seedContent =
      pastedSeedContent ||
      defaultSeedContent(format.roomKind, homeName, awayName)
    const accessPriceUsdc = body.accessPriceUsdc?.trim() || '0.0001'
    const steerPriceUsdc = body.steerPriceUsdc?.trim() || '0.0001'

    stage = 'creator-wallet'
    const walletId = body.creatorWalletId?.trim()
    const address = body.creatorAddress?.trim()
    if (!walletId || !address || !isAddress(address)) {
      return NextResponse.json(
        {
          error:
            'Login or sign up first so Gaffer can attach your Circle Arc wallet to this room.',
        },
        { status: 401 },
      )
    }

    let balance = { formatted: '0', raw: 0n }
    let fundingWarning: string | undefined
    try {
      balance = await readUsdcBalance(address as Address)
    } catch (balanceErr: unknown) {
      const message =
        balanceErr instanceof Error ? balanceErr.message : String(balanceErr)
      fundingWarning =
        'Gaffer attached your Circle Arc wallet, but could not refresh its USDC balance.'
      console.warn('[session/create] creator balance read failed', {
        walletId,
        address,
        message,
      })
    }

    stage = 'session-build'
    const sessionId = randomUUID()
    let dailyRoomUrl = body.dailyRoomUrl?.trim()
    if (format.roomKind === 'live-video' && !dailyRoomUrl) {
      stage = 'daily-room'
      const dailyRoom = await createDailyRoom({
        name: `gaffer-${sessionId.slice(0, 8)}`,
        maxParticipants: 6,
      })
      dailyRoomUrl = dailyRoom?.url
    }
    const matchState: MatchState = {
      id: sessionId,
      experienceType: format.id,
      roomKind: format.roomKind,
      experienceLabel: format.label,
      experienceSummary: format.summary,
      seedTitle: homeName,
      seedTopic: awayName,
      seedContent,
      dailyRoomUrl,
      accessPriceUsdc,
      steerPriceUsdc,
      unlockedWallets: [],
      branches: [],
      creatorWalletId: walletId,
      creatorAddress: address as Address,
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
      detail:
        format.roomKind === 'football'
          ? `${format.label}: ${homeName} vs ${awayName} was attached to the creator's Circle Arc wallet.`
          : `${format.label}: "${homeName}" was attached to the creator's Circle Arc wallet.`,
      data: {
        experienceType: format.id,
        experienceLabel: format.label,
        roomKind: format.roomKind,
        accessPriceUsdc,
        steerPriceUsdc,
        hasDailyRoom: Boolean(dailyRoomUrl),
        creatorEmail: body.creatorEmail,
        creatorWalletId: walletId,
        creatorAddress: address,
        balanceRaw: balance.raw.toString(),
        fundingWarning,
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
        fundingWarning,
      },
      matchState,
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
    console.error('[session/create] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}

function defaultSeedContent(
  roomKind: string,
  title: string,
  topic: string,
): string {
  if (roomKind === 'article') {
    return `A creator essay titled "${title}" exploring ${topic}. Readers can pay to unlock it, then pay again to generate their own angle, rebuttal, local version, or continuation.`
  }
  if (roomKind === 'live-video') {
    return `A live video room about ${topic}. The creator uses paid audience steering to decide what to answer, explain, perform, or demonstrate next.`
  }
  if (roomKind === 'story-video') {
    return `A story seed titled "${title}": ${topic}. Viewers pay to generate their own short storyboard-video branch from this world.`
  }
  return `A crowd-steered football experience where supporters pay USDC to influence ${title} against ${topic}.`
}
