import { randomUUID } from 'node:crypto'
import type { ProvenanceCategory, ProvenanceEvent, Session } from './types'
import { broadcast } from './sse'
import { persistSession } from './session-store'

interface ProvenanceInput {
  category: ProvenanceCategory
  title: string
  detail: string
  data?: Record<string, unknown>
  ts?: number
}

const MAX_PROVENANCE_EVENTS = 200

export function appendProvenance(
  session: Session,
  input: ProvenanceInput,
): ProvenanceEvent {
  const event: ProvenanceEvent = {
    id: randomUUID(),
    ts: input.ts ?? Date.now(),
    minute: session.matchState.minute,
    category: input.category,
    title: input.title,
    detail: input.detail,
    data: input.data,
  }

  session.provenanceEvents.push(event)
  if (session.provenanceEvents.length > MAX_PROVENANCE_EVENTS) {
    session.provenanceEvents.splice(
      0,
      session.provenanceEvents.length - MAX_PROVENANCE_EVENTS,
    )
  }

  persistSession(session)

  broadcast(session, {
    kind: 'provenance',
    event,
    serverTime: Date.now(),
  })

  return event
}
