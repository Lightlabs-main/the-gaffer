import { NextResponse } from 'next/server'
import { getSession, persistSession } from '@/lib/session-store'
import { appendProvenance } from '@/lib/provenance'
import { broadcast } from '@/lib/sse'

export const dynamic = 'force-dynamic'

interface UpdateBody {
  sessionId?: string
  creatorWalletId?: string
  seedTitle?: string
  seedTopic?: string
  seedContent?: string
  dailyRoomUrl?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as UpdateBody
    if (!body.sessionId || !body.creatorWalletId) {
      return NextResponse.json(
        { error: 'sessionId and creatorWalletId are required' },
        { status: 400 },
      )
    }

    const session = await getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }
    if (session.matchState.creatorWalletId !== body.creatorWalletId) {
      return NextResponse.json({ error: 'creator wallet mismatch' }, { status: 403 })
    }
    if (session.matchState.roomKind === 'football') {
      return NextResponse.json(
        { error: 'football sessions do not use creator seed editing' },
        { status: 400 },
      )
    }

    const nextTitle = body.seedTitle?.trim()
    const nextTopic = body.seedTopic?.trim()
    const nextContent = body.seedContent?.trim()
    const nextDailyRoomUrl = body.dailyRoomUrl?.trim()

    if (session.matchState.roomKind === 'article' && !nextContent) {
      return NextResponse.json(
        { error: 'paste the article body before saving' },
        { status: 400 },
      )
    }

    if (nextTitle) {
      session.matchState.seedTitle = nextTitle
      session.matchState.homeTeam.name = nextTitle
    }
    if (nextTopic) {
      session.matchState.seedTopic = nextTopic
      session.matchState.awayTeam.name = nextTopic
    }
    if (nextContent) {
      session.matchState.seedContent = nextContent
    }
    if (session.matchState.roomKind === 'live-video') {
      session.matchState.dailyRoomUrl = nextDailyRoomUrl
    }

    await persistSession(session)
    appendProvenance(session, {
      category: 'session',
      title: 'Creator seed updated',
      detail: `${session.matchState.seedTitle ?? session.matchState.experienceLabel} was updated by the creator.`,
      data: {
        roomKind: session.matchState.roomKind,
        seedTitle: session.matchState.seedTitle,
        seedTopic: session.matchState.seedTopic,
        hasDailyRoom: Boolean(session.matchState.dailyRoomUrl),
      },
    })
    broadcast(session, {
      kind: 'seed-updated',
      matchState: session.matchState,
      serverTime: Date.now(),
    })

    return NextResponse.json({
      sessionId: session.id,
      matchState: session.matchState,
      provenanceEvents: session.provenanceEvents,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[session/update] failed:', message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
