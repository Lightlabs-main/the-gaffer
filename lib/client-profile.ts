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
  loginLabel?: string
  loginProvider?: 'dynamic' | 'email'
  dynamicWalletAddress?: string
  walletId: string
  address: string
  balance?: string
  balanceRaw?: string
  fundingTransactionId?: string
  fundingWarning?: string
  chainId?: number
  asset?: string
  fundingRequired?: boolean
  createdAt: number
}

const PROFILE_KEY = 'gaffer_profile_matches'
const PROFILE_IDENTITY_KEY = 'gaffer_profile_identity'
const PROFILE_IDENTITIES_KEY = 'gaffer_profile_identities_by_email'

function readIdentityCookie(): ProfileIdentity | null {
  if (typeof document === 'undefined') return null
  try {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${PROFILE_IDENTITY_KEY}=`))
    if (!cookie) return null
    const value = cookie.slice(PROFILE_IDENTITY_KEY.length + 1)
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

function writeIdentityCookie(identity: ProfileIdentity) {
  if (typeof document === 'undefined') return
  const encoded = encodeURIComponent(JSON.stringify(identity))
  document.cookie = `${PROFILE_IDENTITY_KEY}=${encoded}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
}

function clearIdentityCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${PROFILE_IDENTITY_KEY}=; path=/; max-age=0; samesite=lax`
}

function readIdentityMap(): Record<string, ProfileIdentity> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PROFILE_IDENTITIES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ProfileIdentity>) : {}
  } catch {
    return {}
  }
}

function saveIdentityMap(identities: Record<string, ProfileIdentity>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_IDENTITIES_KEY, JSON.stringify(identities))
}

export function readProfileIdentityByEmail(email: string): ProfileIdentity | null {
  if (typeof window === 'undefined') return null
  const key = email.trim().toLowerCase()
  if (!key) return null
  const identity = readIdentityMap()[key]
  if (!identity?.email || !identity.walletId || !identity.address) return null
  return identity
}

export function hasProfileIdentity(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.localStorage.getItem(PROFILE_IDENTITY_KEY) || readIdentityCookie(),
  )
}

export function hasDynamicProfileIdentity(): boolean {
  const identity = readProfileIdentity()
  return Boolean(
    identity &&
      (identity.walletId?.startsWith('dynamic:') ||
        (identity.dynamicWalletAddress &&
          identity.address?.toLowerCase() ===
            identity.dynamicWalletAddress.toLowerCase())),
  )
}

export function hasCircleProfileIdentity(): boolean {
  const identity = readProfileIdentity()
  return Boolean(
    identity &&
      identity.loginProvider === 'email' &&
      !identity.walletId?.startsWith('dynamic:'),
  )
}

export function readProfileIdentity(): ProfileIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_IDENTITY_KEY)
    if (!raw) return readIdentityCookie()
    const parsed = JSON.parse(raw) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return readIdentityCookie()
  }
}

export function saveProfileIdentity(identity: ProfileIdentity) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_IDENTITY_KEY, JSON.stringify(identity))
  const identities = readIdentityMap()
  identities[identity.email.trim().toLowerCase()] = identity
  saveIdentityMap(identities)
  writeIdentityCookie(identity)
}

export function clearProfileIdentity() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PROFILE_IDENTITY_KEY)
  window.localStorage.removeItem(PROFILE_KEY)
  clearIdentityCookie()
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

export function upsertProfileMatch(
  record: Omit<ProfileMatchRecord, 'createdAt' | 'lastSeenAt'> & {
    createdAt?: number
    lastSeenAt?: number
  },
): ProfileMatchRecord[] {
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
