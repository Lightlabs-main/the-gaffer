/**
 * GET /api/decision/current?sessionId=<id>
 *
 * Returns the currently-open DecisionWindow for a session (or `null` if none).
 * Includes a `msUntilClose` countdown so the UI doesn't have to compare clocks.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { getTaps } from '@/lib/decision-lifecycle'

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param required' }, { status: 400 })
  }
  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'session not found', sessionId }, { status: 404 })
  }
  const decision = session.matchState.currentDecision ?? null
  const now = Date.now()
  return NextResponse.json({
    sessionId,
    decision,
    msUntilClose: decision ? Math.max(0, decision.closesAt - now) : null,
    tapCount: decision ? getTaps(sessionId).length : 0,
    serverTime: now,
  })
}
