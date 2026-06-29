'use client'

export type ProfileRole = 'creator' | 'participant'
export type ProfileStatus = 'running' | 'closed' | 'offline'

export interface ProfileMatchRecord {
  sessionId: string
  role: ProfileRole
  walletId?: string
  address?: string
  createdAt: number
  lastSeenAt: number
  status?: ProfileStatus
  totalEarned?: number
}

export interface ProfileIdentity {
  email: string
  walletId: string
  address: string
  balance?: string
  balanceRaw?: string
  fundingTransactionId?: string
  chainId?: number
  asset?: string
  createdAt: number
}

const PROFILE_KEY = 'gaffer_profile_matches'
const PROFILE_IDENTITY_KEY = 'gaffer_profile_identity'

export function hasProfileIdentity(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(PROFILE_IDENTITY_KEY))
}

export function readProfileIdentity(): ProfileIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

export function saveProfileIdentity(identity: ProfileIdentity) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_IDENTITY_KEY, JSON.stringify(identity))
}

export function clearProfileIdentity() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PROFILE_IDENTITY_KEY)
  window.localStorage.removeItem(PROFILE_KEY)
}

export function clearProfileMatches() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PROFILE_KEY)
}

export function readProfileMatches(): ProfileMatchRecord[] {
  if (typeof window === 'undefined') return []
  if (!hasProfileIdentity()) return []
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function upsertProfileMatch(record: Omit<ProfileMatchRecord, 'createdAt' | 'lastSeenAt'> & {
  createdAt?: number
  lastSeenAt?: number
}): ProfileMatchRecord[] {
  if (!hasProfileIdentity()) return []
  const now = Date.now()
  const current = readProfileMatches()
  const index = current.findIndex(
    (m) => m.sessionId === record.sessionId && m.role === record.role,
  )
  const next: ProfileMatchRecord = {
    ...current[index],
    ...record,
    createdAt: record.createdAt ?? current[index]?.createdAt ?? now,
    lastSeenAt: record.lastSeenAt ?? now,
  }
  const updated =
    index === -1
      ? [next, ...current]
      : current.map((m, i) => (i === index ? next : m))
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updated.slice(0, 30)))
  return updated
}

export function shortAddress(address?: string | null): string {
  if (!address) return 'No address'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
