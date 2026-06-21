import type { Session } from './types'

/**
 * Module-singleton in-memory session store. No database.
 * Survives only for the lifetime of the Next.js server process.
 */
const sessions = new Map<string, Session>()

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export function setSession(session: Session): void {
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
