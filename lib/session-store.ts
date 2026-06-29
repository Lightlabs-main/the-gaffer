import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Session } from './types'

/**
 * Module-singleton session store with a tiny local JSON backing file.
 * SSE clients are process-local; serializable match state survives dev reloads.
 */
const sessions = new Map<string, Session>()
type PersistedSession = Omit<Session, 'sseClients'>

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'sessions.json')
let loadedFromDisk = false

function ensureLoaded(): void {
  if (loadedFromDisk) return
  loadedFromDisk = true
  if (!existsSync(STORE_FILE)) return

  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    const persisted = JSON.parse(raw) as PersistedSession[]
    for (const session of persisted) {
      sessions.set(session.id, {
        ...session,
        sseClients: new Set(),
      })
    }
  } catch (err) {
    console.warn('[session-store] could not load persisted sessions', err)
  }
}

function saveAll(): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true })
    const persisted: PersistedSession[] = Array.from(sessions.values()).map(
      (storedSession) => {
        const { sseClients, ...session } = storedSession
        void sseClients
        return session
      },
    )
    writeFileSync(STORE_FILE, JSON.stringify(persisted, null, 2))
  } catch (err) {
    console.warn('[session-store] could not persist sessions', err)
  }
}

export function getSession(id: string): Session | undefined {
  ensureLoaded()
  return sessions.get(id)
}

export function setSession(session: Session): void {
  ensureLoaded()
  sessions.set(session.id, session)
  saveAll()
}

export function persistSession(session: Session): void {
  ensureLoaded()
  sessions.set(session.id, session)
  saveAll()
}

export function deleteSession(id: string): boolean {
  ensureLoaded()
  const deleted = sessions.delete(id)
  if (deleted) saveAll()
  return deleted
}

export function listSessions(): Session[] {
  ensureLoaded()
  return Array.from(sessions.values())
}

export function sessionCount(): number {
  ensureLoaded()
  return sessions.size
}
