/**
 * POST /api/match/start
 *
 * Kicks off the match engine for a session. Starts the clock,
 * opens decision windows on schedule, triggers simulations.
 * Body: { sessionId: string }
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { startEngine, getEngine } from '@/lib/match-engine'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
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

    const existing = getEngine(session.id)
    if (existing) {
      return NextResponse.json({
        message: 'match engine already running',
        matchState: session.matchState,
      })
    }

    startEngine(session)

    return NextResponse.json({
      message: 'match engine started',
      sessionId: session.id,
      matchState: session.matchState,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[match/start] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
