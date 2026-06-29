/**
 * GET /api/session/[id]
 *
 * Returns the current MatchState plus session metadata for a given session id.
 * 404 if the session doesn't exist. The `sseClients` set is omitted from the
 * response — it isn't JSON-serializable and isn't useful to the client.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const session = getSession(id)
  if (!session) {
    return NextResponse.json({ error: 'session not found', id }, { status: 404 })
  }
  return NextResponse.json({
    sessionId: session.id,
    matchState: session.matchState,
    participants: session.participants,
    createdAt: session.createdAt,
    connectedClients: session.sseClients.size,
    provenanceEvents: session.provenanceEvents,
  })
}
