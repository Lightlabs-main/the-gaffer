import type { Session } from './types'

/**
 * Module-singleton session store.
 *
 * The hackathon spec requires in-memory Maps only: no database and no local
 * JSON persistence. Sessions intentionally disappear when the server process
 * restarts.
 */
const sessions = new Map<string, Session>()

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export function setSession(session: Session): void {
  sessions.set(session.id, session)
}

export function persistSession(session: Session): void {
  sessions.set(session.id, session)
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id)
}

export function listSessions(): Session[] {
  return Array.from(sessions.values())
}

export function sessionCount(): number {
  return sessions.size
}
