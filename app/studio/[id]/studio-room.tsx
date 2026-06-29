'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import AccountPanel from '@/components/AccountPanel'
import CreatorEarnings from '@/components/CreatorEarnings'
import MatchCommentary from '@/components/MatchCommentary'
import ProfilePanel from '@/components/ProfilePanel'
import ProvenancePanel from '@/components/ProvenancePanel'
import Scoreboard from '@/components/Scoreboard'
import { shortAddress, upsertProfileMatch } from '@/lib/client-profile'

interface MatchState {
  id: string
  experienceLabel?: string
  experienceSummary?: string
  creatorWalletId: string
  creatorAddress: string
  homeTeam: {
    name: string
    score: number
    formation: string
    mentality: string
    pressing: string
  }
  awayTeam: {
    name: string
    score: number
    formation: string
  }
  minute: number
  status: string
  events: Array<{ id: string; minute: number; type: string; text: string; isGoal?: boolean }>
  totalEarned: number
}

interface SessionResponse {
  sessionId: string
  matchState: MatchState
  participants: number
  connectedClients: number
  provenanceEvents: Array<{
    id: string
    ts: number
    minute: number
    category: string
    title: string
    detail: string
  }>
}

export default function StudioRoom({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedFan, setCopiedFan] = useState(false)
  const [copiedStudio, setCopiedStudio] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load match')
      setData(json)
      upsertProfileMatch({
        sessionId,
        role: 'creator',
        walletId: json.matchState.creatorWalletId,
        address: json.matchState.creatorAddress,
        status: json.matchState.status === 'full-time' ? 'closed' : 'running',
        totalEarned: json.matchState.totalEarned,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load match')
    }
  }, [sessionId])

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0)
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      window.clearTimeout(firstLoad)
      window.clearInterval(timer)
    }
  }, [load])

  async function copy(text: string, kind: 'fan' | 'studio') {
    await navigator.clipboard.writeText(text)
    if (kind === 'fan') {
      setCopiedFan(true)
      window.setTimeout(() => setCopiedFan(false), 1500)
    } else {
      setCopiedStudio(true)
      window.setTimeout(() => setCopiedStudio(false), 1500)
    }
  }

  if (error) {
    return (
      <main className="gaffer-shell flex min-h-screen items-center justify-center px-4 text-zinc-950">
        <section className="match-panel max-w-lg p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pitch-dim)]">
            Creator Studio
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Match unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{error}</p>
          <Link href="/studio" className="mt-5 inline-flex rounded-lg bg-[var(--pitch-green)] px-4 py-2 text-sm font-semibold text-white">
            Create a new match
          </Link>
        </section>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="gaffer-shell flex min-h-screen items-center justify-center text-zinc-950">
        <div className="font-semibold text-[var(--pitch-green)]">Loading Creator Studio...</div>
      </main>
    )
  }

  const match = data.matchState
  const fanLink =
    typeof window === 'undefined'
      ? `/session/${sessionId}`
      : `${window.location.origin}/session/${sessionId}`
  const studioLink =
    typeof window === 'undefined'
      ? `/studio/${sessionId}`
      : `${window.location.origin}/studio/${sessionId}`

  return (
    <main className="gaffer-shell min-h-screen px-4 py-4 text-zinc-950">
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-3">
          <div className="match-panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--pitch-dim)]">
                  Creator Studio
                </p>
                <h1 className="mt-2 text-3xl font-semibold">Live control room</h1>
                <p className="mt-2 text-sm text-zinc-600">
                  {match.experienceSummary ??
                    'This is the host view. Share the fan room link; keep this page for wallet, earnings, and live oversight.'}
                </p>
                <div className="mt-3 inline-flex rounded-full border border-[var(--pitch-green)]/30 bg-[var(--pitch-green)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--pitch-green)]">
                  {match.experienceLabel ?? 'Football simulation stream'}
                </div>
              </div>
              <Link href={`/session/${sessionId}`} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--pitch-green)] hover:border-[var(--pitch-green)]/60">
                Fan room
              </Link>
            </div>
          </div>

          <Scoreboard
            homeName={match.homeTeam.name}
            homeScore={match.homeTeam.score}
            awayName={match.awayTeam.name}
            awayScore={match.awayTeam.score}
            minute={match.minute}
            status={match.status}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <StudioStat label="Supporters" value={data.participants.toString()} />
            <StudioStat label="Connected" value={data.connectedClients.toString()} />
            <StudioStat label="Creator earned" value={`${match.totalEarned.toFixed(4)} USDC`} />
          </div>

          <MatchCommentary events={match.events} />
        </section>

        <aside className="flex flex-col gap-3">
          <AccountPanel />

          <section className="match-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
              Creator wallet
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Supporter streams settle to this Circle developer-controlled wallet.
            </p>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm text-[var(--pitch-green)]">
              {shortAddress(match.creatorAddress)}
            </div>
            <div className="mt-2 break-all font-mono text-[10px] text-zinc-600">
              walletId {match.creatorWalletId}
            </div>
          </section>

          <section className="match-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
              Share links
            </h2>
            <button
              onClick={() => copy(fanLink, 'fan')}
              className="mt-3 w-full rounded-lg border border-[var(--pitch-dim)] px-4 py-2 text-sm font-semibold text-[var(--pitch-green)] hover:bg-[var(--pitch-green)]/10"
            >
              {copiedFan ? 'Fan link copied' : 'Copy fan room link'}
            </button>
            <button
              onClick={() => copy(studioLink, 'studio')}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-[var(--pitch-green)]/60"
            >
              {copiedStudio ? 'Studio link copied' : 'Copy studio link'}
            </button>
          </section>

          <CreatorEarnings
            sessionId={sessionId}
            creatorWalletId={match.creatorWalletId}
            creatorAddress={match.creatorAddress}
            totalEarned={match.totalEarned}
          />

          <ProvenancePanel events={data.provenanceEvents} />

          <ProfilePanel />
        </aside>
      </div>
    </main>
  )
}

function StudioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="match-panel p-3">
      <div className="font-mono text-xl font-semibold text-zinc-950">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  )
}
