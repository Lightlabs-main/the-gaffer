/**
 * POST /api/match/simulate
 *
 * Standalone endpoint to trigger a match simulation segment.
 * Body: { sessionId: string, fromMinute?: number, toMinute?: number }
 *
 * The match engine calls the simulator automatically, but this route
 * lets callers trigger it independently for testing and proof.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { simulateMatchSegment } from '@/lib/match-simulator'
import { broadcast } from '@/lib/sse'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  fromMinute?: number
  toMinute?: number
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }

    const ms = session.matchState
    const fromMinute = body.fromMinute ?? ms.minute
    const toMinute = body.toMinute ?? Math.min(ms.minute + 15, 90)

    const result = await simulateMatchSegment({
      matchState: ms,
      fromMinute,
      toMinute,
    })

    // Apply events to match state
    for (const event of result.events) {
      ms.events.push(event)
      if (event.type === 'goal') {
        ms.homeTeam.score++
      } else if (event.type === 'goal-conceded') {
        ms.awayTeam.score++
      }
    }

    // Broadcast to SSE clients
    broadcast(session, {
      kind: 'simulation',
      fromMinute,
      toMinute,
      events: result.events,
      matchState: ms,
      model: result.model,
      latencyMs: result.latencyMs,
      serverTime: Date.now(),
    })

    return NextResponse.json({
      fromMinute,
      toMinute,
      events: result.events,
      score: {
        home: ms.homeTeam.score,
        away: ms.awayTeam.score,
      },
      model: result.model,
      latencyMs: result.latencyMs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[match/simulate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
