import MatchRoom from './match-room'
import { getSession } from '@/lib/session-store'

export const dynamic = 'force-dynamic'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession(id)
  const initialSession = session
    ? {
        sessionId: session.id,
        matchState: session.matchState,
        participants: session.participants,
        createdAt: session.createdAt,
        connectedClients: session.sseClients.size,
        provenanceEvents: session.provenanceEvents,
      }
    : null

  return <MatchRoom sessionId={id} initialSession={initialSession} />
}
