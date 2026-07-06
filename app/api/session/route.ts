import { NextResponse } from 'next/server'
import { listSessions } from '@/lib/session-store'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const sessions = await listSessions()
  return NextResponse.json(
    sessions.map((session) => ({
      id: session.id,
      matchState: session.matchState,
      participants: session.participants,
      createdAt: session.createdAt,
      provenanceEvents: session.provenanceEvents,
    })),
  )
}
