import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Session } from './types'
import { normalizeUsdc } from './money'
import { kvGetJson, kvSetJson } from './persistent-kv'

type PersistedSession = Omit<Session, 'sseClients'> & {
  sseClients?: never
}

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'sessions.json')
const SESSION_INDEX_KEY = 'gaffer:sessions:index'
const SESSION_KEY_PREFIX = 'gaffer:session:'

const sessions = new Map<string, Session>()
let loadedFromDisk = false

function sessionKey(id: string): string {
  return `${SESSION_KEY_PREFIX}${id}`
}

function hydrateSession(persisted: PersistedSession): Session {
  const session: Session = {
    ...persisted,
    matchState: {
      ...persisted.matchState,
      totalEarned: normalizeUsdc(persisted.matchState.totalEarned),
    },
    sseClients: new Set(),
  }
  return session
}

function serializeSession(session: Session): PersistedSession {
  return {
    id: session.id,
    matchState: session.matchState,
    participants: session.participants,
    createdAt: session.createdAt,
    provenanceEvents: session.provenanceEvents,
  }
}

function ensureLoadedFromDisk(): void {
  if (loadedFromDisk) return
  loadedFromDisk = true
  if (!existsSync(STORE_FILE)) return

  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    const persisted = JSON.parse(raw) as PersistedSession[]
    for (const session of persisted) {
      sessions.set(session.id, hydrateSession(session))
    }
  } catch (err) {
    console.warn('[session-store] could not load persisted sessions', err)
  }
}

function saveAllToDisk(): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true })
    writeFileSync(
      STORE_FILE,
      JSON.stringify(Array.from(sessions.values()).map(serializeSession), null, 2),
    )
  } catch (err) {
    console.warn('[session-store] could not persist sessions', err)
  }
}

async function readSessionIndex(): Promise<string[]> {
  try {
    return (await kvGetJson<string[]>(SESSION_INDEX_KEY)) ?? []
  } catch (err) {
    console.warn('[session-store] KV index read failed, falling back to local file', err)
    ensureLoadedFromDisk()
    return Array.from(sessions.keys())
  }
}

async function writeSessionIndex(ids: string[]): Promise<void> {
  try {
    await kvSetJson(SESSION_INDEX_KEY, Array.from(new Set(ids)))
  } catch (err) {
    console.warn('[session-store] KV index write failed, falling back to local file', err)
    saveAllToDisk()
  }
}

export async function getSession(id: string): Promise<Session | undefined> {
  const cached = sessions.get(id)
  if (cached) {
    cached.matchState.totalEarned = normalizeUsdc(cached.matchState.totalEarned)
    return cached
  }

  try {
    const persisted = await kvGetJson<PersistedSession>(sessionKey(id))
    if (persisted?.id) {
      const session = hydrateSession(persisted)
      sessions.set(session.id, session)
      return session
    }
  } catch (err) {
    console.warn('[session-store] KV session read failed, falling back to local file', err)
  }

  ensureLoadedFromDisk()
  const session = sessions.get(id)
  if (session) session.matchState.totalEarned = normalizeUsdc(session.matchState.totalEarned)
  return session
}

export function getCachedSession(id: string): Session | undefined {
  const session = sessions.get(id)
  if (session) session.matchState.totalEarned = normalizeUsdc(session.matchState.totalEarned)
  return session
}

export async function setSession(session: Session): Promise<void> {
  sessions.set(session.id, session)
  try {
    await kvSetJson(sessionKey(session.id), serializeSession(session))
    const ids = await readSessionIndex()
    if (!ids.includes(session.id)) await writeSessionIndex([session.id, ...ids])
  } catch (err) {
    console.warn('[session-store] KV session write failed, falling back to local file', err)
    saveAllToDisk()
  }
}

export async function persistSession(session: Session): Promise<void> {
  await setSession(session)
}

export async function deleteSession(id: string): Promise<boolean> {
  const existed = sessions.delete(id)
  const ids = await readSessionIndex()
  await writeSessionIndex(ids.filter((sessionId) => sessionId !== id))
  return existed
}

export async function listSessions(): Promise<Session[]> {
  const ids = await readSessionIndex()
  const loaded = await Promise.all(ids.map((id) => getSession(id)))
  const fromKv = loaded.filter((session): session is Session => Boolean(session))
  if (fromKv.length) return fromKv

  ensureLoadedFromDisk()
  return Array.from(sessions.values())
}

export async function sessionCount(): Promise<number> {
  return (await listSessions()).length
}
