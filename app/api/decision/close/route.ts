/**
 * POST /api/decision/close
 *
 * Body: { sessionId: string }
 *
 * Manually closes the currently-open decision window (the auto-close timer
 * scheduled when the window opened will hit this same code path). Idempotent
 * — closing an already-closed window returns the engine's last verdict.
 *
 * Side-effects: runs the decision engine on the recorded taps, marks the
 * window closed, sets `result`, broadcasts `decision-closed` to all SSE
 * listeners. Phase 6 (AI Manager) will later read this event and post the
 * manager speech back to the broadcast.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { closeDecisionWindow } from '@/lib/decision-lifecycle'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }
  const session = getSession(body.sessionId)
  if (!session) {
    return NextResponse.json({ error: 'session not found', sessionId: body.sessionId }, { status: 404 })
  }
  const result = closeDecisionWindow(session)
  return NextResponse.json({ sessionId: session.id, ...result })
}
