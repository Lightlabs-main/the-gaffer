import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Session } from './types'
import { normalizeUsdc } from './money'
import { kvGetJson, kvSetJson } from './persistent-kv'
import { env } from './env'

type PersistedSession = Omit<Session, 'sseClients'> & {
  sseClients?: never
}

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'sessions.json')
const SESSION_INDEX_KEY = 'gaffer:sessions:index'
const SESSION_KEY_PREFIX = 'gaffer:session:'

const sessions = new Map<string, Session>()
let loadedFromDisk = false

function backendOrigin(): string | undefined {
  const origin = env.optionalBackendOrigin()?.replace(/\/+$/, '')
  const appUrl = env.appUrl().replace(/\/+$/, '')
  if (!origin || origin === appUrl) return undefined
  return origin
}

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

async function fetchBackendJson<T>(path: string): Promise<T | null> {
  const origin = backendOrigin()
  if (!origin) return null
  const res = await fetch(`${origin}${path}`, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`Backend ${path} failed with HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

function sessionFromApi(data: {
  sessionId?: string
  id?: string
  matchState: PersistedSession['matchState']
  participants: number
  createdAt: number
  provenanceEvents: PersistedSession['provenanceEvents']
}): Session {
  return hydrateSession({
    id: data.id ?? data.sessionId ?? data.matchState.id,
    matchState: data.matchState,
    participants: data.participants,
    createdAt: data.createdAt,
    provenanceEvents: data.provenanceEvents,
  })
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
    const ids = (await kvGetJson<string[]>(SESSION_INDEX_KEY)) ?? []
    if (ids.length) return ids
    ensureLoadedFromDisk()
    return Array.from(sessions.keys())
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
  const backendSession = await fetchBackendJson<{
    sessionId: string
    matchState: PersistedSession['matchState']
    participants: number
    createdAt: number
    provenanceEvents: PersistedSession['provenanceEvents']
  }>(`/api/session/${encodeURIComponent(id)}`)
  if (backendSession) return sessionFromApi(backendSession)

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
  saveAllToDisk()
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
  saveAllToDisk()
  const ids = await readSessionIndex()
  await writeSessionIndex(ids.filter((sessionId) => sessionId !== id))
  return existed
}

export async function listSessions(): Promise<Session[]> {
  const backendSessions = await fetchBackendJson<
    Array<{
      id: string
      matchState: PersistedSession['matchState']
      participants: number
      createdAt: number
      provenanceEvents: PersistedSession['provenanceEvents']
    }>
  >('/api/session')
  if (backendSessions) return backendSessions.map(sessionFromApi)

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
