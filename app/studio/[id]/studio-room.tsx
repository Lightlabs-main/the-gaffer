'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import CreatorEarnings from '@/components/CreatorEarnings'
import MatchCommentary from '@/components/MatchCommentary'
import ProvenancePanel from '@/components/ProvenancePanel'
import Scoreboard from '@/components/Scoreboard'
import { shortAddress, upsertProfileMatch } from '@/lib/client-profile'
import type { MatchState, ProvenanceEvent } from '@/lib/types'

interface SessionResponse {
  sessionId: string
  matchState: MatchState
  participants: number
  connectedClients: number
  provenanceEvents: ProvenanceEvent[]
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
      if (!res.ok) throw new Error(json.error || 'Could not load room')
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
      setError(err instanceof Error ? err.message : 'Could not load room')
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
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <section className="max-w-lg rounded-sm border border-rule bg-card p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Creator Studio
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Room unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{error}</p>
          <Link href="/studio" className="mt-5 inline-flex rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper">
            Create a new room
          </Link>
        </section>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-accent">Loading Creator Studio...</div>
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
  const isMediaRoom = Boolean(match.roomKind && match.roomKind !== 'football')

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="font-serif text-xl italic">
              Gaffer
            </Link>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted sm:inline">
              Studio - Room console
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/studio"
              className="rounded-full border border-rule px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-secondary"
            >
              Studio
            </Link>
            <Link
              href={`/session/${sessionId}`}
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper"
            >
              Fan room
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-6 px-4 py-6 sm:px-6">
        <section className="col-span-12 rounded-sm border border-rule bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
                Creator Studio
              </p>
              <h1 className="mt-2 font-serif text-5xl leading-none">
                {studioRoomTitle(match.roomKind)}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-muted">
                {match.experienceSummary ??
                  'Manage the room, share the fan link, and track paid decisions from one workspace.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                {match.accessPriceUsdc ?? '0.0001'} USDC access
              </span>
              <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                {match.steerPriceUsdc ?? '0.0001'} USDC steer
              </span>
            </div>
          </div>
        </section>

        <section className="col-span-12 flex min-w-0 flex-col gap-6 lg:col-span-8">
          {isMediaRoom ? (
            <CreatorMediaOverview
              sessionId={sessionId}
              match={match}
              onUpdated={(nextMatch) =>
                setData((current) =>
                  current ? { ...current, matchState: nextMatch } : current,
                )
              }
            />
          ) : (
            <Scoreboard
              homeName={match.homeTeam.name}
              homeScore={match.homeTeam.score}
              awayName={match.awayTeam.name}
              awayScore={match.awayTeam.score}
              minute={match.minute}
              status={match.status}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StudioStat label="Supporters" value={data.participants.toString()} />
            <StudioStat label="Connected" value={data.connectedClients.toString()} />
            <StudioStat label="Creator earned" value={`${match.totalEarned.toFixed(4)} USDC`} />
          </div>

          {isMediaRoom ? (
            <CreatorBranchOverview match={match} />
          ) : (
            <MatchCommentary events={match.events} />
          )}
        </section>

        <aside className="col-span-12 flex min-w-0 flex-col gap-6 lg:col-span-4">
          <SettlementProof match={match} events={data.provenanceEvents} />

          <section className="rounded-sm border border-rule bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              Share
            </p>
            <h2 className="mt-2 text-lg font-semibold text-ink">Room links</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Send the fan room link to readers. Keep this studio link private for
              editing and monitoring.
            </p>
            <Link
              href={`/session/${sessionId}`}
              className="mt-4 flex w-full items-center justify-center rounded-sm bg-ink px-4 py-3 text-sm font-medium text-paper"
            >
              Open fan room
            </Link>
            <button
              onClick={() => copy(fanLink, 'fan')}
              className="mt-2 w-full rounded-sm border border-rule px-4 py-3 text-sm font-medium text-ink hover:bg-secondary"
            >
              {copiedFan ? 'Fan room link copied' : 'Copy fan room link'}
            </button>
            <button
              onClick={() => copy(studioLink, 'studio')}
              className="mt-2 w-full rounded-sm border border-rule px-4 py-3 text-sm font-medium text-ink hover:bg-secondary"
            >
              {copiedStudio ? 'Studio link copied' : 'Copy studio link'}
            </button>
          </section>

          <ProvenancePanel events={data.provenanceEvents} />
        </aside>

        <section className="col-span-12">
          <CreatorEarnings
            sessionId={sessionId}
            creatorWalletId={match.creatorWalletId}
            creatorAddress={match.creatorAddress}
            totalEarned={match.totalEarned}
          />
        </section>
      </div>
    </main>
  )
}

function StudioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-rule bg-card p-4">
      <div className="font-mono text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {label}
      </div>
    </div>
  )
}

function SettlementProof({
  events,
  match,
}: {
  events: ProvenanceEvent[]
  match: MatchState
}) {
  const signedEvent = [...events]
    .reverse()
    .find((event) => event.category === 'wallet' && event.data?.txHash)
  const txHash = signedEvent?.data?.txHash
  const payer = signedEvent?.data?.payerAddress

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Arc settlement proof
      </p>
      <h2 className="mt-2 text-lg font-semibold text-ink">
        {txHash ? 'Signed activation recorded' : 'Awaiting signed activation'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        This room stores the wallet signature, settlement destination, and
        provenance event used to activate the paid article.
      </p>
      <div className="mt-4 space-y-3">
        <ProofRow label="Room wallet" value={shortAddress(match.creatorAddress)} />
        <ProofRow
          label="Creator wallet"
          value={typeof payer === 'string' ? shortAddress(payer) : 'Not recorded'}
        />
        <ProofRow
          label="Signed tx"
          value={typeof txHash === 'string' ? shortAddress(txHash) : 'Not recorded'}
        />
      </div>
      {typeof txHash === 'string' && (
        <div className="mt-4 break-all rounded-sm border border-rule bg-secondary p-3 font-mono text-[11px] leading-5 text-ink-muted">
          {txHash}
        </div>
      )}
    </section>
  )
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-rule bg-secondary p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm text-ink">{value}</div>
    </div>
  )
}

function studioRoomTitle(roomKind: MatchState['roomKind']): string {
  if (roomKind === 'article') return 'Article writing desk'
  if (roomKind === 'live-video') return 'Live video control room'
  if (roomKind === 'story-video') return 'Story video desk'
  return 'Match control room'
}

function CreatorMediaOverview({
  sessionId,
  match,
  onUpdated,
}: {
  sessionId: string
  match: MatchState
  onUpdated: (match: MatchState) => void
}) {
  const [title, setTitle] = useState(match.seedTitle ?? match.homeTeam.name)
  const [topic, setTopic] = useState(match.seedTopic ?? match.awayTeam.name)
  const [content, setContent] = useState(match.seedContent ?? '')
  const [dailyRoomUrl, setDailyRoomUrl] = useState(match.dailyRoomUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function saveSeed() {
    setSaving(true)
    setSaveMessage(null)
    setSaveError(null)
    try {
      const res = await fetch('/api/session/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          creatorWalletId: match.creatorWalletId,
          seedTitle: title,
          seedTopic: topic,
          seedContent: content,
          dailyRoomUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Could not save seed')
      onUpdated(json.matchState)
      setSaveMessage('Saved. Fan room updated.')
      window.setTimeout(() => setSaveMessage(null), 1800)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Could not save seed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-sm border border-rule bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Article desk
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            {match.roomKind === 'article' ? 'Writer article' : 'Creator seed'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            {match.roomKind === 'article'
              ? "Paste the writer's real article here. Readers unlock this exact text before paying to steer their own branch."
              : 'Edit the seed viewers will unlock before steering.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {match.accessPriceUsdc ?? '0.0001'} USDC access
        </span>
      </div>

      {match.roomKind === 'live-video' && (
        <div className="mt-4 overflow-hidden rounded-sm border border-rule bg-black">
          {dailyRoomUrl ? (
            <iframe
              title="Creator Daily room"
              src={dailyRoomUrl}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="h-[420px] w-full bg-zinc-950"
            />
          ) : (
            <div className="grid min-h-[260px] place-items-center bg-secondary p-8 text-center">
              <div>
                <h3 className="text-lg font-semibold text-ink">No Daily room attached</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  Paste a Daily URL below, or add DAILY_API_KEY for auto-created rooms.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {match.roomKind === 'article' ? 'Article title' : 'Seed title'}
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="gaffer-input h-11 font-semibold"
          />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {match.roomKind === 'article' ? 'Subtitle / topic' : 'Premise'}
          </span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="gaffer-input h-11 font-semibold"
          />
        </label>
      </div>

      {match.roomKind === 'live-video' && (
        <label className="mt-4 grid gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Daily room URL
          </span>
          <input
            value={dailyRoomUrl}
            onChange={(event) => setDailyRoomUrl(event.target.value)}
            placeholder="https://your-domain.daily.co/room"
            className="gaffer-input"
          />
        </label>
      )}

      <label className="mt-4 grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {match.roomKind === 'article' ? 'Full article body' : 'Seed body'}
          </span>
          <span className="font-mono text-[10px] text-ink-muted">
            {wordCount(content)} words
          </span>
        </div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={match.roomKind === 'article' ? 10 : 6}
          placeholder={
            match.roomKind === 'article'
              ? 'Paste the full article here.'
              : 'Write the seed viewers will unlock and steer.'
          }
          className="gaffer-input min-h-[340px] resize-y text-[15px] leading-7"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rule bg-secondary px-3 py-3">
        <div className="text-xs leading-5 text-ink-muted">
          {match.roomKind === 'article'
            ? 'Save after pasting. The fan room updates immediately.'
            : 'Save changes before sharing the fan room.'}
        </div>
        <button
          onClick={() => void saveSeed()}
          disabled={
            saving ||
            !title.trim() ||
            !topic.trim() ||
            (match.roomKind === 'article' && !content.trim())
          }
          className="rounded-sm bg-ink px-5 py-3 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? 'Saving...' : match.roomKind === 'article' ? 'Save article' : 'Save seed'}
        </button>
        {saveMessage && <span className="text-sm font-semibold text-accent">{saveMessage}</span>}
        {saveError && <span className="text-sm font-semibold text-red-600">{saveError}</span>}
      </div>
    </section>
  )
}

function CreatorBranchOverview({ match }: { match: MatchState }) {
  const branches = match.branches ?? []
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Steering
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            Paid branch output
          </h2>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {match.steerPriceUsdc ?? '0.0001'} USDC per steer
        </span>
      </div>
      {!branches.length ? (
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Audience branches, live director cues, and story-video boards will appear here after supporters pay to steer.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {branches.slice(0, 5).map((branch) => (
            <article key={branch.id} className="rounded-sm border border-rule bg-secondary p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
                    {branch.kind.replace('-', ' ')}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">{branch.title}</h3>
                </div>
                <span className="font-mono text-xs text-ink-muted">{branch.amountUsdc} USDC</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{branch.summary}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}
