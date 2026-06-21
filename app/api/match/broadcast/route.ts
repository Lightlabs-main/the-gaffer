/**
 * POST /api/match/broadcast
 *
 * Test/internal endpoint that pushes a JSON payload to every SSE listener of
 * a session. Body: `{ sessionId: string, payload: unknown }`. Returns the
 * number of delivered frames.
 *
 * Real later phases (decision/close, match/simulate, manager/speak) will call
 * `broadcast()` directly from lib/sse.ts. This endpoint is the trigger we use
 * to prove the Phase 3 gate.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { broadcast } from '@/lib/sse'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  payload?: unknown
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
  const delivered = broadcast(session, body.payload ?? null)
  return NextResponse.json({ sessionId: session.id, delivered, listeners: session.sseClients.size })
}
