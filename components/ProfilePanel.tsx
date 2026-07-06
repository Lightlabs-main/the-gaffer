'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  clearProfileMatches,
  hasProfileIdentity,
  readProfileMatches,
  shortAddress,
  type ProfileIdentity,
  type ProfileMatchRecord,
  type ProfileStatus,
} from '@/lib/client-profile'

interface SessionProbe {
  sessionId: string
  matchState?: {
    status: string
    totalEarned: number
    homeTeam: { score: number }
    awayTeam: { score: number }
    minute: number
  }
}

export default function ProfilePanel({
  initialIdentity = null,
}: {
  initialIdentity?: ProfileIdentity | null
}) {
  const [matches, setMatches] = useState<ProfileMatchRecord[]>([])
  const [signedIn, setSignedIn] = useState(Boolean(initialIdentity))
  const [hadStaleData, setHadStaleData] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const identity = hasProfileIdentity()
      setSignedIn(identity)
      setHadStaleData(
        !identity && Boolean(window.localStorage.getItem('gaffer_profile_matches')),
      )
      if (!identity) {
        setMatches([])
        return
      }
      const local = readProfileMatches()
      const refreshed = await Promise.all(
        local.map(async (match) => {
          try {
            const res = await fetch(`/api/session/${match.sessionId}`)
            if (!res.ok) throw new Error('session unavailable')
            const data = (await res.json()) as SessionProbe
            const status = statusFromMatch(data.matchState?.status)
            return {
              ...match,
              status,
              totalEarned: data.matchState?.totalEarned ?? match.totalEarned,
            }
          } catch {
            return { ...match, status: 'offline' as const }
          }
        }),
      )
      if (!cancelled) setMatches(refreshed)
    }
    void load()
    window.addEventListener('gaffer-auth-changed', load)
    return () => {
      cancelled = true
      window.removeEventListener('gaffer-auth-changed', load)
    }
  }, [])

  function clearStaleData() {
    clearProfileMatches()
    setHadStaleData(false)
    setMatches([])
  }

  const steered = matches.filter((m) => m.role === 'participant')
  const running = matches.filter((m) => m.status === 'running')
  const closed = matches.filter((m) => m.status === 'closed' || m.status === 'offline')

  return (
    <section className="rounded-sm border border-rule bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
          Profile
        </h2>
        <Link
          href="/profile"
          className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-accent hover:bg-secondary"
        >
          Open
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <ProfileStat label="Steered" value={steered.length} />
        <ProfileStat label="Running" value={running.length} />
        <ProfileStat label="Closed" value={closed.length} />
      </div>
      <div className="mt-3 flex max-h-40 flex-col gap-2 overflow-y-auto">
        {!signedIn ? (
          <div className="rounded-sm border border-rule bg-secondary p-3">
            <p className="text-xs leading-5 text-ink-muted">
              You are not logged in, so no room history is attached to this
              browser account yet.
            </p>
            {hadStaleData && (
              <button
                onClick={clearStaleData}
                className="mt-3 rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:bg-card"
              >
                Clear old test profile data
              </button>
            )}
          </div>
        ) : matches.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Rooms you create or join will appear here.
          </p>
        ) : (
          matches.slice(0, 6).map((match) => (
            <Link
              key={`${match.role}-${match.sessionId}`}
              href={`/session/${match.sessionId}`}
              className="flex items-center justify-between rounded-sm border border-rule bg-secondary px-3 py-2 text-xs hover:border-accent/60"
            >
              <span>
                <span className="font-semibold text-ink">{match.role}</span>
                <span className="ml-2 font-mono text-ink-muted">
                  {match.sessionId.slice(0, 8)}...
                </span>
              </span>
              <span className={statusClass(match.status)}>{match.status ?? 'offline'}</span>
            </Link>
          ))
        )}
      </div>
      {matches[0]?.address && (
        <div className="mt-3 border-t border-rule pt-3 font-mono text-xs text-ink-muted">
          Latest wallet {shortAddress(matches[0].address)}
        </div>
      )}
    </section>
  )
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-rule bg-secondary px-2 py-2">
      <div className="font-mono text-lg font-semibold text-ink">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
    </div>
  )
}

function statusFromMatch(status?: string): ProfileStatus {
  if (status === 'full-time') return 'closed'
  if (!status) return 'offline'
  return 'running'
}

function statusClass(status?: ProfileStatus): string {
  if (status === 'running') return 'text-accent'
  if (status === 'closed') return 'text-ink'
  return 'text-ink-muted'
}
