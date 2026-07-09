'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  hasCircleProfileIdentity,
  readProfileIdentity,
  upsertProfileMatch,
  type ProfileIdentity,
} from '@/lib/client-profile'
import CircleAccountPanel from '@/components/CircleAccountPanel'
import {
  EXPERIENCE_FORMATS,
  getExperienceFormat,
  type ExperienceType,
  type RoomKind,
} from '@/lib/experience-formats'
import type { MatchState, ProvenanceEvent } from '@/lib/types'

type StudioSection =
  | 'Overview'
  | 'All rooms'
  | 'Live video'
  | 'Articles'
  | 'Story seeds'
  | 'Wallet'
  | 'Payouts'
  | 'Provenance'
  | 'Audience'
  | 'Settings'

interface ArticleTrendDraft {
  title: string
  topic: string
  article: string
  suggestedSteers: string[]
  sources: Array<{
    title: string
    url: string
    content: string
  }>
  agent: {
    name: string
    model: string
    researchService: string
    researchCredits?: number
    researchCostUsdc: string
    requestId?: string | null
    generatedAt: number
  }
}

interface CreatedRoom {
  sessionId: string
  creator?: {
    walletId?: string
    address?: string
  }
}

interface SessionApiSummary {
  id?: string
  sessionId?: string
  matchState: MatchState
  participants: number
  createdAt: number
  provenanceEvents: ProvenanceEvent[]
}

export interface StudioRoomSummary {
  id: string
  roomKind: RoomKind
  experienceType: ExperienceType
  status: MatchState['status']
  label: string
  title: string
  topic: string
  createdAt: number
  accessPriceUsdc: string
  steerPriceUsdc: string
  totalEarned: number
  branches: number
  paidSteers: number
  unlocks: number
  participants: number
  creatorWalletId: string
  creatorAddress: string
  lastTxHash?: string
  provenanceEvents: ProvenanceEvent[]
}

const sideGroups: Array<[string, StudioSection[]]> = [
  ['Studio', ['Overview']],
  ['Rooms', ['All rooms', 'Live video', 'Articles', 'Story seeds']],
  ['Money', ['Wallet', 'Payouts', 'Provenance']],
  ['Ops', ['Audience', 'Settings']],
]

const sectionHashes: Record<StudioSection, string> = {
  Overview: 'overview',
  'All rooms': 'all-rooms',
  'Live video': 'live-video',
  Articles: 'articles',
  'Story seeds': 'story-seeds',
  Wallet: 'wallet',
  Payouts: 'payouts',
  Provenance: 'provenance',
  Audience: 'audience',
  Settings: 'settings',
}

const sectionFromHash = Object.fromEntries(
  Object.entries(sectionHashes).map(([section, hash]) => [hash, section]),
) as Record<string, StudioSection>

const roomKindBySection: Partial<Record<StudioSection, RoomKind>> = {
  'Live video': 'live-video',
  Articles: 'article',
  'Story seeds': 'story-video',
}

function requiresCreatorSeed(roomKind: RoomKind) {
  return roomKind === 'article' || roomKind === 'story-video'
}

function isSessionApiSummary(value: unknown): value is SessionApiSummary {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SessionApiSummary>
  return Boolean(
    candidate.matchState &&
      typeof candidate.createdAt === 'number' &&
      Array.isArray(candidate.provenanceEvents),
  )
}

function roomFromSession(session: SessionApiSummary): StudioRoomSummary {
  const id = session.id ?? session.sessionId ?? session.matchState.id
  const txEvent = [...session.provenanceEvents]
    .reverse()
    .find((event) => event.data?.txHash || event.data?.transactionId)
  const paidSteers = session.provenanceEvents.filter(
    (event) => event.category === 'stream' || event.category === 'branch',
  ).length
  const unlockEvents = session.provenanceEvents.filter(
    (event) => event.category === 'access',
  ).length
  return {
    id,
    roomKind: session.matchState.roomKind,
    experienceType: session.matchState.experienceType,
    status: session.matchState.status,
    label: session.matchState.experienceLabel,
    title:
      session.matchState.seedTitle ||
      session.matchState.homeTeam.name ||
      session.matchState.experienceLabel,
    topic:
      session.matchState.seedTopic ||
      session.matchState.awayTeam.name ||
      session.matchState.experienceSummary,
    createdAt: session.createdAt,
    accessPriceUsdc: session.matchState.accessPriceUsdc ?? '0.0001',
    steerPriceUsdc: session.matchState.steerPriceUsdc ?? '0.0001',
    totalEarned: session.matchState.totalEarned,
    branches: session.matchState.branches?.length ?? 0,
    paidSteers: Math.max(paidSteers, session.matchState.branches?.length ?? 0),
    unlocks: Math.max(
      unlockEvents,
      session.matchState.unlockedWallets?.length ?? 0,
    ),
    participants: session.participants,
    creatorWalletId: session.matchState.creatorWalletId,
    creatorAddress: session.matchState.creatorAddress,
    lastTxHash:
      typeof txEvent?.data?.txHash === 'string'
        ? txEvent.data.txHash
        : typeof txEvent?.data?.transactionId === 'string'
          ? txEvent.data.transactionId
          : undefined,
    provenanceEvents: session.provenanceEvents,
  }
}

interface StudioMetrics {
  totalEarned: number
  liveRooms: number
  closedRooms: number
  paidSteers: number
  unlocks: number
  pending: number
  activities: Array<{
    id: string
    label: string
    actor: string
    amount: string
    createdAt: number
  }>
}

function buildStudioMetrics(rooms: StudioRoomSummary[]): StudioMetrics {
  const totalEarned = rooms.reduce((sum, room) => sum + room.totalEarned, 0)
  const liveRooms = rooms.filter((room) => room.status !== 'full-time').length
  const closedRooms = rooms.filter((room) => room.status === 'full-time').length
  const paidSteers = rooms.reduce((sum, room) => sum + room.paidSteers, 0)
  const unlocks = rooms.reduce((sum, room) => sum + room.unlocks, 0)
  const pending = rooms
    .filter((room) => room.status !== 'full-time')
    .reduce((sum, room) => sum + room.totalEarned, 0)
  const activities = rooms
    .flatMap((room) =>
      room.provenanceEvents
        .filter((event) =>
          ['access', 'stream', 'branch'].includes(event.category),
        )
        .map((event) => ({
          id: `${room.id}-${event.id}`,
          label:
            event.category === 'access'
              ? 'UNLOCK'
              : event.category === 'branch'
                ? 'BRANCH'
                : 'STEER',
          actor: shortId(
            String(
              event.data?.address ??
                event.data?.payer ??
                event.data?.walletId ??
                room.creatorAddress,
            ),
          ),
          amount: `${formatUsdcAmount(Number(event.data?.amountUsdc ?? 0))} USDC`,
          createdAt: event.ts,
        })),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8)

  return {
    totalEarned,
    liveRooms,
    closedRooms,
    paidSteers,
    unlocks,
    pending,
    activities,
  }
}

export default function StudioHomeClient({
  initialIdentity = null,
  initialSectionParam,
  initialSignedIn = false,
  initialRooms = [],
}: {
  initialIdentity?: ProfileIdentity | null
  initialSectionParam?: string
  initialSignedIn?: boolean
  initialRooms?: StudioRoomSummary[]
}) {
  return (
    <StudioHomeForm
      initialIdentity={initialIdentity}
      initialSectionParam={initialSectionParam}
      initialSignedIn={initialSignedIn}
      initialRooms={initialRooms}
    />
  )
}

function StudioHomeForm({
  initialIdentity,
  initialSectionParam,
  initialSignedIn,
  initialRooms,
}: {
  initialIdentity: ProfileIdentity | null
  initialSectionParam?: string
  initialSignedIn: boolean
  initialRooms: StudioRoomSummary[]
}) {
  const router = useRouter()
  const initialSection = sectionFromHash[initialSectionParam ?? ''] ?? 'Overview'
  const initialFormat = getFirstFormatForSection(initialSection)
  const [creating, setCreating] = useState(false)
  const [experienceType, setExperienceType] =
    useState<ExperienceType>(initialFormat.id)
  const selectedFormat = getExperienceFormat(experienceType)
  const [homeTeamName, setHomeTeamName] = useState<string>(
    selectedFormat.defaultHome,
  )
  const [awayTeamName, setAwayTeamName] = useState<string>(
    selectedFormat.defaultAway,
  )
  const [seedContent, setSeedContent] = useState('')
  const [dailyRoomUrl, setDailyRoomUrl] = useState('')
  const [trendTopic, setTrendTopic] = useState(
    'YouTube creator economy trends this week',
  )
  const [trendAngle, setTrendAngle] = useState(
    'Explain why audiences will pay to steer their own version.',
  )
  const [trendDraft, setTrendDraft] = useState<ArticleTrendDraft | null>(null)
  const [trendGenerating, setTrendGenerating] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [accessPriceUsdc, setAccessPriceUsdc] = useState('0.0001')
  const [steerPriceUsdc, setSteerPriceUsdc] = useState('0.0001')
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(initialSignedIn)
  const [rooms, setRooms] = useState(initialRooms)
  const activeSection = initialSection
  const metrics = useMemo(() => buildStudioMetrics(rooms), [rooms])

  const visibleFormats = useMemo(() => {
    const kind = roomKindBySection[activeSection]
    return kind
      ? EXPERIENCE_FORMATS.filter((format) => format.roomKind === kind)
      : EXPERIENCE_FORMATS
  }, [activeSection])

  useEffect(() => {
    function refreshIdentity() {
      setSignedIn(hasCircleProfileIdentity())
    }
    refreshIdentity()
    window.addEventListener('gaffer-auth-changed', refreshIdentity)
    return () => window.removeEventListener('gaffer-auth-changed', refreshIdentity)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refreshRooms() {
      try {
        const res = await fetch('/api/session', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as unknown
        if (!Array.isArray(data)) return
        const nextRooms = data
          .filter((item): item is SessionApiSummary => isSessionApiSummary(item))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(roomFromSession)
        if (!cancelled) setRooms(nextRooms)
      } catch {
        // Keep the server-rendered room list if the backend refresh fails.
      }
    }

    refreshRooms()
    window.addEventListener('gaffer-auth-changed', refreshRooms)
    return () => {
      cancelled = true
      window.removeEventListener('gaffer-auth-changed', refreshRooms)
    }
  }, [initialIdentity])

  function chooseFormat(nextType: ExperienceType) {
    const nextFormat = getExperienceFormat(nextType)
    setExperienceType(nextType)
    setHomeTeamName(nextFormat.defaultHome)
    setAwayTeamName(nextFormat.defaultAway)
    setSeedContent('')
    setDailyRoomUrl('')
    setTrendDraft(null)
    setTrendError(null)
  }

  async function generateTrendArticle() {
    setTrendGenerating(true)
    setTrendError(null)
    try {
      const res = await fetch('/api/article/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trendTopic,
          angle: trendAngle,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate article')
      const draft = data as ArticleTrendDraft
      setTrendDraft(draft)
      setHomeTeamName(draft.title)
      setAwayTeamName(draft.topic)
      setSeedContent(draft.article)
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : 'Failed to generate article')
    } finally {
      setTrendGenerating(false)
    }
  }

  async function createRoom(): Promise<CreatedRoom> {
    if (!signedIn) {
      setError('Login first so the creator wallet and room history are attached.')
      throw new Error('Login first so the creator wallet and room history are attached.')
    }
    const identity = readProfileIdentity()
    if (!identity || identity.loginProvider !== 'email') {
      setError('Login or sign up with email so Gaffer can attach your Circle Arc wallet.')
      throw new Error('Login or sign up with email so Gaffer can attach your Circle Arc wallet.')
    }
    if (requiresCreatorSeed(selectedFormat.roomKind) && !seedContent.trim()) {
      const message =
        selectedFormat.roomKind === 'story-video'
          ? 'Write the story seed before launching.'
          : 'Paste the article body before launching.'
      setError(message)
      throw new Error(message)
    }
    setCreating(true)
    setError(null)
    const res = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceType,
        homeTeamName,
        awayTeamName,
        seedContent,
        dailyRoomUrl,
        accessPriceUsdc,
        steerPriceUsdc,
        creatorEmail: identity.email,
        creatorWalletId: identity.walletId,
        creatorAddress: identity.address,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || data.error || 'Failed to create room')
    return data as CreatedRoom
  }

  function completeRoomCreate(data: CreatedRoom) {
    upsertProfileMatch({
      sessionId: data.sessionId,
      role: 'creator',
      walletId: data.creator?.walletId,
      address: data.creator?.address,
      status: 'running',
      totalEarned: 0,
    })
    router.push(`/session/${data.sessionId}`)
  }

  async function createMatch() {
    try {
      const data = await createRoom()
      completeRoomCreate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
      setCreating(false)
    }
  }

  const needsSeedContent = requiresCreatorSeed(selectedFormat.roomKind)
  const canLaunch = Boolean(
    !creating &&
      signedIn &&
      homeTeamName.trim() &&
      awayTeamName.trim() &&
      accessPriceUsdc.trim() &&
      steerPriceUsdc.trim() &&
      (!needsSeedContent || seedContent.trim()),
  )

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-paper text-ink">
        <StudioTopbar
          canLaunch={false}
          onCreate={createMatch}
          totalEarned={0}
        />
        <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-[1200px] grid-cols-12 gap-8 px-4 py-8 sm:px-6 lg:py-14">
          <div className="col-span-12 flex flex-col justify-center lg:col-span-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              Studio access
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-6xl leading-[0.9] sm:text-7xl">
              Sign in before opening the creator console.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted">
              Gaffer is a paid media console. Creators enter with email, then
              Gaffer creates a Circle Arc wallet for rooms, steers, provenance,
              and payouts.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'Login', 'Email signup'],
                ['02', 'Wallet', 'Circle Arc wallet'],
                ['03', 'Studio', 'Launch rooms with USDC'],
              ].map(([step, title, copy]) => (
                <div key={step} className="rounded-sm border border-rule bg-card p-4">
                  <p className="font-mono text-[10px] text-accent">{step}</p>
                  <h2 className="mt-3 text-sm font-semibold text-ink">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">{copy}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="col-span-12 flex items-center lg:col-span-5">
            <div className="w-full rounded-sm border border-rule bg-card p-5 shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">
                Login required
              </p>
              <h2 className="mt-2 font-serif text-3xl">Log in or sign up.</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Enter your email below. Gaffer creates or reuses your Circle Arc
                wallet, then opens the full studio on this same page.
              </p>
              <div className="mt-5">
                <CircleAccountPanel initialIdentity={initialIdentity} />
              </div>
            </div>
          </aside>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <StudioTopbar
        canLaunch={canLaunch}
        onCreate={createMatch}
        totalEarned={metrics.totalEarned}
      />
      <MobileSectionNav
        activeSection={activeSection}
      />
      <div className="mx-auto flex max-w-[1400px]">
        <StudioSidebar
          activeSection={activeSection}
        />
        <section className="min-w-0 flex-1 px-4 py-8 sm:px-6">
          {activeSection === 'Overview' && (
            <OverviewSection
              canLaunch={canLaunch}
              onCreate={createMatch}
              metrics={metrics}
              rooms={rooms}
            />
          )}

          {isRoomSection(activeSection) && (
            <RoomsSection
              activeSection={activeSection}
              canLaunch={canLaunch}
              creating={creating}
              dailyRoomUrl={dailyRoomUrl}
              error={error}
              experienceType={experienceType}
              formats={visibleFormats}
              homeTeamName={homeTeamName}
              accessPriceUsdc={accessPriceUsdc}
              awayTeamName={awayTeamName}
              seedContent={seedContent}
              selectedFormat={selectedFormat}
              steerPriceUsdc={steerPriceUsdc}
              trendAngle={trendAngle}
              trendDraft={trendDraft}
              trendError={trendError}
              trendGenerating={trendGenerating}
              trendTopic={trendTopic}
              rooms={rooms}
              onChooseFormat={chooseFormat}
              onCreate={createMatch}
              onDailyRoomUrlChange={setDailyRoomUrl}
              onGenerateTrendArticle={generateTrendArticle}
              onHomeTeamNameChange={setHomeTeamName}
              onAccessPriceUsdcChange={setAccessPriceUsdc}
              onAwayTeamNameChange={setAwayTeamName}
              onSeedContentChange={setSeedContent}
              onSteerPriceUsdcChange={setSteerPriceUsdc}
              onTrendAngleChange={setTrendAngle}
              onTrendTopicChange={setTrendTopic}
            />
          )}

          {activeSection === 'Wallet' && (
            <WalletSection initialIdentity={initialIdentity} metrics={metrics} />
          )}
          {activeSection === 'Payouts' && <PayoutsSection metrics={metrics} />}
          {activeSection === 'Provenance' && <ProvenanceSection />}
          {activeSection === 'Audience' && <AudienceSection metrics={metrics} />}
          {activeSection === 'Settings' && (
            <SettingsSection
              accessPriceUsdc={accessPriceUsdc}
              steerPriceUsdc={steerPriceUsdc}
              onAccessPriceUsdcChange={setAccessPriceUsdc}
              onSteerPriceUsdcChange={setSteerPriceUsdc}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function StudioTopbar({
  canLaunch,
  onCreate,
  totalEarned,
}: {
  canLaunch: boolean
  onCreate: () => void
  totalEarned: number
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="font-serif text-xl italic">
            Gaffer
          </Link>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted sm:inline">
            Studio - Creator console
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full border border-rule px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted md:inline-flex">
            {formatUsdcAmount(totalEarned)} USDC
          </span>
          <Link
            href={sectionHref('Wallet')}
            className="inline-flex items-center rounded-full border border-rule px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-secondary"
          >
            Account
          </Link>
          <button
            onClick={onCreate}
            disabled={!canLaunch}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + New room
          </button>
        </div>
      </div>
    </header>
  )
}

function MobileSectionNav({
  activeSection,
}: {
  activeSection: StudioSection
}) {
  const sections = sideGroups.flatMap(([, items]) => items)
  return (
    <div className="sticky top-14 z-30 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((section) => (
          <Link
            key={section}
            href={sectionHref(section)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              activeSection === section
                ? 'border-ink bg-ink text-paper'
                : 'border-rule bg-card text-ink'
            }`}
          >
            {section}
          </Link>
        ))}
      </div>
    </div>
  )
}

function StudioSidebar({
  activeSection,
}: {
  activeSection: StudioSection
}) {
  return (
    <aside className="hidden min-h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-rule bg-secondary/30 px-3 py-6 lg:block">
      <nav className="space-y-6">
        {sideGroups.map(([heading, items]) => (
          <div key={heading}>
            <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              {heading}
            </p>
            <ul className="space-y-0.5">
              {items.map((item, index) => (
                <li key={item}>
                  <Link
                    href={sectionHref(item)}
                    className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
                      activeSection === item
                        ? 'bg-ink text-paper'
                        : 'text-ink hover:bg-secondary'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-ink-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{item}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-8 rounded-sm border border-rule bg-paper p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Tip
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink">
            Every paid steer becomes a provenance event. Payouts settle into the
            creator wallet attached to each room.
          </p>
        </div>
      </nav>
    </aside>
  )
}

function OverviewSection({
  canLaunch,
  metrics,
  onCreate,
  rooms,
}: {
  canLaunch: boolean
  metrics: StudioMetrics
  onCreate: () => void
  rooms: StudioRoomSummary[]
}) {
  const recentRooms = rooms.slice(0, 4)
  const studioStats = [
    ['USDC earned', formatUsdcAmount(metrics.totalEarned), 'settled'],
    ['Rooms live now', String(metrics.liveRooms), `${rooms.length} total`],
    ['Paid steers', String(metrics.paidSteers), 'on Arc'],
    ['Unlocks', String(metrics.unlocks), 'paid access'],
  ]
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Studio - Overview
          </p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">
            Creator operating console.
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Choose one work area from the left. Rooms, wallet, payouts,
            provenance, audience, and settings are now separated so each section
            can be managed cleanly.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-sm border border-rule px-3.5 py-2 text-sm hover:bg-secondary"
          >
            Home
          </Link>
          <button
            onClick={onCreate}
            disabled={!canLaunch}
            className="inline-flex items-center gap-2 rounded-sm bg-ink px-3.5 py-2 text-sm text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            Launch room
          </button>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {studioStats.map(([label, value, delta]) => (
          <div key={label} className="rounded-sm border border-rule bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              {label}
            </p>
            <p className="mt-1 font-serif text-3xl">{value}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-accent">
              {delta}
            </p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-sm border border-rule bg-card">
        <div className="relative min-h-72 p-6 sm:p-8">
          <Image
            src="/hero-tactics.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover opacity-20"
          />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              Creator Studio
            </p>
            <h2 className="mt-2 font-serif text-5xl leading-[0.95] sm:text-6xl">
              Create paid interactive media.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Articles, live video, story-video seeds, and football all use the
              same core mechanic: unlock with USDC, steer with USDC, record the
              decision.
            </p>
            <Link
              href={sectionHref('All rooms')}
              className="mt-6 rounded-sm bg-ink px-4 py-3 text-sm font-medium text-paper"
            >
              Open room formats
            </Link>
          </div>
        </div>
      </section>
      <PublishedRoomsList
        emptyCopy="Your published rooms will appear here after you launch them."
        rooms={recentRooms}
        title="Recent published rooms"
      />
    </div>
  )
}

function RoomsSection(props: {
  activeSection: StudioSection
  canLaunch: boolean
  creating: boolean
  dailyRoomUrl: string
  error: string | null
  experienceType: ExperienceType
  formats: readonly (typeof EXPERIENCE_FORMATS)[number][]
  homeTeamName: string
  accessPriceUsdc: string
  awayTeamName: string
  seedContent: string
  selectedFormat: ReturnType<typeof getExperienceFormat>
  steerPriceUsdc: string
  trendAngle: string
  trendDraft: ArticleTrendDraft | null
  trendError: string | null
  trendGenerating: boolean
  trendTopic: string
  rooms: StudioRoomSummary[]
  onChooseFormat: (type: ExperienceType) => void
  onCreate: () => void
  onDailyRoomUrlChange: (value: string) => void
  onGenerateTrendArticle: () => void
  onHomeTeamNameChange: (value: string) => void
  onAccessPriceUsdcChange: (value: string) => void
  onAwayTeamNameChange: (value: string) => void
  onSeedContentChange: (value: string) => void
  onSteerPriceUsdcChange: (value: string) => void
  onTrendAngleChange: (value: string) => void
  onTrendTopicChange: (value: string) => void
}) {
  const needsArticle = props.selectedFormat.roomKind === 'article'
  const needsSeedContent = requiresCreatorSeed(props.selectedFormat.roomKind)
  const visiblePublishedRooms = filterRoomsForSection(props.rooms, props.activeSection)
  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 rounded-sm border border-rule bg-card p-5 lg:col-span-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
          {props.activeSection}
        </p>
        <h1 className="mt-2 font-serif text-4xl">
          {roomSectionTitle(props.activeSection)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {roomSectionCopy(props.activeSection)}
        </p>
        <div className="mt-5 grid gap-3">
          {props.formats.map((format) => (
            <button
              key={format.id}
              onClick={() => props.onChooseFormat(format.id)}
              className={`rounded-sm border p-4 text-left transition ${
                props.experienceType === format.id
                  ? 'border-accent bg-secondary'
                  : 'border-rule hover:bg-secondary'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{format.label}</h2>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                  {format.status === 'live' ? 'Playable now' : 'Queued'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                {format.summary}
              </p>
            </button>
          ))}
        </div>
      </section>
      <section className="col-span-12 rounded-sm border border-rule bg-card p-5 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              Room setup
            </p>
            <h2 className="mt-1 font-serif text-3xl">
              {props.selectedFormat.label}
            </h2>
          </div>
          <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {props.accessPriceUsdc} USDC access
          </span>
        </div>
        {needsArticle && (
          <ArticleTrendAgentPanel
            draft={props.trendDraft}
            error={props.trendError}
            generating={props.trendGenerating}
            topic={props.trendTopic}
            angle={props.trendAngle}
            onAngleChange={props.onTrendAngleChange}
            onGenerate={props.onGenerateTrendArticle}
            onTopicChange={props.onTrendTopicChange}
          />
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label={props.selectedFormat.creatorLabel}>
            <input
              value={props.homeTeamName}
              onChange={(e) => props.onHomeTeamNameChange(e.target.value)}
              className="gaffer-input"
            />
          </Field>
          <Field label={props.selectedFormat.opponentLabel}>
            <input
              value={props.awayTeamName}
              onChange={(e) => props.onAwayTeamNameChange(e.target.value)}
              className="gaffer-input"
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Access price USDC">
            <input
              value={props.accessPriceUsdc}
              onChange={(e) => props.onAccessPriceUsdcChange(e.target.value)}
              className="gaffer-input font-mono"
            />
          </Field>
          <Field label="Steer price USDC">
            <input
              value={props.steerPriceUsdc}
              onChange={(e) => props.onSteerPriceUsdcChange(e.target.value)}
              className="gaffer-input font-mono"
            />
          </Field>
        </div>
        {props.selectedFormat.roomKind !== 'football' && (
          <label className="mt-4 grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                {props.selectedFormat.roomKind === 'article'
                  ? 'Paste full article'
                  : props.selectedFormat.roomKind === 'story-video'
                    ? 'Story seed'
                    : 'Live room brief'}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                {wordCount(props.seedContent)} words
              </span>
            </div>
            <textarea
              value={props.seedContent}
              onChange={(e) => props.onSeedContentChange(e.target.value)}
              rows={props.selectedFormat.roomKind === 'article' ? 14 : 7}
              placeholder={
                props.selectedFormat.roomKind === 'live-video'
                  ? 'Describe the live show and what viewers can steer.'
                  : props.selectedFormat.roomKind === 'story-video'
                    ? 'Write the world, characters, and story seed users will branch into storyboard videos.'
                    : "Paste the writer's actual article here. This is what readers pay to unlock before they steer their own branch."
              }
              className="gaffer-input min-h-44 resize-y leading-6"
            />
            {needsSeedContent && (
              <span className="text-xs leading-5 text-ink-muted">
                {props.selectedFormat.roomKind === 'story-video'
                  ? 'The story seed is required. Supporters unlock this before paying to generate storyboard-video branches.'
                  : 'The article body is required. Gaffer will not replace it with a generated sample.'}
              </span>
            )}
          </label>
        )}
        {props.selectedFormat.roomKind === 'live-video' && (
          <Field label="Daily room URL" className="mt-4">
            <input
              value={props.dailyRoomUrl}
              onChange={(e) => props.onDailyRoomUrlChange(e.target.value)}
              placeholder="Optional. Leave blank to auto-create if DAILY_API_KEY is set."
              className="gaffer-input"
            />
          </Field>
        )}
        <button
          type="button"
          onClick={props.onCreate}
          disabled={!props.canLaunch || props.creating}
          className="mt-5 w-full rounded-sm bg-ink px-5 py-4 text-sm font-medium text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {props.creating
            ? 'Creating Circle settlement room...'
            : `Publish ${props.selectedFormat.shortLabel} with Circle Arc wallet`}
        </button>
        {props.error && (
          <div className="mt-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
            {props.error}
          </div>
        )}
      </section>
      <section className="col-span-12">
        <PublishedRoomsList
          emptyCopy={
            props.activeSection === 'Articles'
              ? 'No article rooms yet. Paste an article above, publish it, and it will appear here.'
              : props.activeSection === 'Story seeds'
                ? 'No story-video seeds yet. Write a seed above, publish it, and it will appear here.'
              : 'No rooms in this section yet.'
          }
          rooms={visiblePublishedRooms}
          title={
            props.activeSection === 'Articles'
              ? 'Published articles'
              : props.activeSection === 'Story seeds'
                ? 'Published story-video seeds'
              : `Published ${props.activeSection.toLowerCase()}`
          }
        />
      </section>
    </div>
  )
}

function PublishedRoomsList({
  emptyCopy,
  rooms,
  title,
}: {
  emptyCopy: string
  rooms: StudioRoomSummary[]
  title: string
}) {
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Library
          </p>
          <h2 className="mt-1 font-serif text-3xl">{title}</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {rooms.length} saved
        </span>
      </div>
      {rooms.length === 0 ? (
        <p className="mt-4 rounded-sm border border-rule bg-secondary p-4 text-sm leading-6 text-ink-muted">
          {emptyCopy}
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/session/${room.id}`}
              className="grid gap-4 rounded-sm border border-rule bg-secondary p-4 transition hover:border-accent md:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                    {room.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    {formatDate(room.createdAt)}
                  </span>
                </div>
                <h3 className="mt-2 truncate text-base font-semibold text-ink">
                  {room.title}
                </h3>
                <p className="mt-1 truncate text-sm text-ink-muted">{room.topic}</p>
                {room.lastTxHash && (
                  <p className="mt-2 truncate font-mono text-[10px] text-ink-muted">
                    last tx {shortId(room.lastTxHash)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-right md:min-w-72">
                <MiniMetric label="unlock" value={`${room.accessPriceUsdc} USDC`} />
                <MiniMetric label="branches" value={String(room.branches)} />
                <MiniMetric label="earned" value={`${room.totalEarned} USDC`} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-rule bg-card p-2">
      <p className="truncate font-mono text-xs font-semibold text-ink">{value}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
        {label}
      </p>
    </div>
  )
}

function ArticleTrendAgentPanel({
  angle,
  draft,
  error,
  generating,
  onAngleChange,
  onGenerate,
  onTopicChange,
  topic,
}: {
  angle: string
  draft: ArticleTrendDraft | null
  error: string | null
  generating: boolean
  onAngleChange: (value: string) => void
  onGenerate: () => void
  onTopicChange: (value: string) => void
  topic: string
}) {
  return (
    <section className="mt-5 rounded-sm border border-rule bg-secondary p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
            AI trend agent
          </p>
          <h3 className="mt-1 text-sm font-semibold text-ink">
            Generate a creator draft from a live trend
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-muted">
            Optional. Writers can still paste their own article below. The agent
            researches with Tavily, drafts with Claude, then you approve by
            launching the room.
          </p>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          0.0001 USDC research event
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Trend or niche">
          <input
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="Crypto state, YouTube niche, World Cup..."
            className="gaffer-input"
          />
        </Field>
        <Field label="Creator angle">
          <input
            value={angle}
            onChange={(e) => onAngleChange(e.target.value)}
            placeholder="What should the article argue?"
            className="gaffer-input"
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating || !topic.trim()}
        className="mt-4 w-full rounded-sm border border-accent bg-accent px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating ? 'Agent researching and drafting...' : 'Generate article from trend'}
      </button>
      {error && (
        <div className="mt-3 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-600">
          {error}
        </div>
      )}
      {draft && (
        <div className="mt-4 grid gap-3 rounded-sm border border-rule bg-card p-3 text-xs leading-5 text-ink-muted">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono uppercase tracking-[0.2em] text-accent">
              Draft loaded into editor
            </span>
            <span className="font-mono text-ink-muted">
              {draft.agent.researchService}
              {draft.agent.researchCredits
                ? ` - ${draft.agent.researchCredits} credit`
                : ''}
            </span>
          </div>
          <p>
            <span className="text-ink">Suggested paid steers:</span>{' '}
            {draft.suggestedSteers.join(' / ')}
          </p>
          {draft.sources.length > 0 && (
            <div>
              <p className="font-mono uppercase tracking-[0.2em] text-ink-muted">
                Sources
              </p>
              <ul className="mt-1 space-y-1">
                {draft.sources.slice(0, 3).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function WalletSection({
  initialIdentity,
  metrics,
}: {
  initialIdentity: ProfileIdentity | null
  metrics: StudioMetrics
}) {
  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 lg:col-span-5">
        <CircleAccountPanel initialIdentity={initialIdentity} />
      </section>
      <section className="col-span-12 rounded-sm border border-rule bg-card p-5 lg:col-span-7">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Creator room history
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ['Steered', String(metrics.paidSteers)],
            ['Running', String(metrics.liveRooms)],
            ['Closed', String(metrics.closedRooms)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-sm border border-rule bg-secondary p-4">
              <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                {label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Room history lives here, not pinned beside every screen. Creators can
          check activity when they need it and stay focused elsewhere.
        </p>
      </section>
    </div>
  )
}

function PayoutsSection({ metrics }: { metrics: StudioMetrics }) {
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Payouts
      </p>
      <h1 className="mt-2 font-serif text-4xl">Creator USDC payouts.</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ['Available', formatUsdcAmount(metrics.totalEarned), 'Settled in rooms'],
          ['Pending', formatUsdcAmount(metrics.pending), 'Active rooms'],
          ['Paid out', '0.0000', 'Withdrawals not run yet'],
        ].map(([label, value, copy]) => (
          <div key={label} className="rounded-sm border border-rule bg-secondary p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              {label}
            </p>
            <p className="mt-2 font-serif text-4xl">{value}</p>
            <p className="mt-1 text-xs text-ink-muted">{copy}</p>
          </div>
        ))}
      </div>
      <button className="mt-5 rounded-sm bg-ink px-5 py-3 text-sm font-medium text-paper">
        Withdraw creator USDC
      </button>
    </section>
  )
}

function ProvenanceSection() {
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Provenance
      </p>
      <h1 className="mt-2 font-serif text-4xl">Decision history.</h1>
      <div className="mt-6 grid gap-3">
        {[
          ['Window opened', 'Supporters can unlock and steer a live decision window.'],
          ['Stream received', 'USDC intent is attached to an option, prompt, or branch.'],
          ['Decision recorded', 'The creator or AI response is written into room history.'],
          ['Outcome settled', 'Payouts and final state stay auditable for replay.'],
        ].map(([title, copy], index) => (
          <div key={title} className="rounded-sm border border-rule bg-secondary p-4">
            <p className="font-mono text-[10px] text-accent">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h2 className="mt-2 text-sm font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AudienceSection({ metrics }: { metrics: StudioMetrics }) {
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Audience
      </p>
      <h1 className="mt-2 font-serif text-4xl">Supporter activity.</h1>
      <ul className="mt-6 divide-y divide-rule rounded-sm border border-rule">
        {metrics.activities.length === 0 && (
          <li className="p-4 text-sm leading-6 text-ink-muted">
            No paid unlocks or steers have settled yet.
          </li>
        )}
        {metrics.activities.map((activity) => (
          <li key={activity.id} className="flex items-center justify-between p-4 text-sm">
            <span>
              <span className="font-mono text-accent">{activity.label}</span> -{' '}
              {activity.actor}
            </span>
            <span className="font-mono text-ink-muted">{activity.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SettingsSection({
  accessPriceUsdc,
  steerPriceUsdc,
  onAccessPriceUsdcChange,
  onSteerPriceUsdcChange,
}: {
  accessPriceUsdc: string
  steerPriceUsdc: string
  onAccessPriceUsdcChange: (value: string) => void
  onSteerPriceUsdcChange: (value: string) => void
}) {
  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
        Settings
      </p>
      <h1 className="mt-2 font-serif text-4xl">Studio defaults.</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Default access price USDC">
          <input
            value={accessPriceUsdc}
            onChange={(e) => onAccessPriceUsdcChange(e.target.value)}
            className="gaffer-input font-mono"
          />
        </Field>
        <Field label="Default steer price USDC">
          <input
            value={steerPriceUsdc}
            onChange={(e) => onSteerPriceUsdcChange(e.target.value)}
            className="gaffer-input font-mono"
          />
        </Field>
      </div>
    </section>
  )
}

function Field({
  children,
  className = '',
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function isRoomSection(section: StudioSection): boolean {
  return ['All rooms', 'Live video', 'Articles', 'Story seeds'].includes(section)
}

function sectionHref(section: StudioSection): string {
  return `/studio?login=1&section=${sectionHashes[section]}`
}

function getFirstFormatForSection(section: StudioSection) {
  const kind = roomKindBySection[section]
  return (
    (kind && EXPERIENCE_FORMATS.find((format) => format.roomKind === kind)) ||
    EXPERIENCE_FORMATS[0]
  )
}

function filterRoomsForSection(
  rooms: StudioRoomSummary[],
  section: StudioSection,
): StudioRoomSummary[] {
  const kind = roomKindBySection[section]
  return kind ? rooms.filter((room) => room.roomKind === kind) : rooms
}

function shortId(value: string): string {
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function formatUsdcAmount(value: number): string {
  if (!Number.isFinite(value)) return '0.0000'
  if (value === 0) return '0.0000'
  if (value < 0.01) return value.toFixed(4)
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function roomSectionTitle(section: StudioSection): string {
  if (section === 'Articles') return 'Article rooms only.'
  if (section === 'Live video') return 'Live video rooms only.'
  if (section === 'Story seeds') return 'Story-video seeds only.'
  return 'All room formats.'
}

function roomSectionCopy(section: StudioSection): string {
  if (section === 'Articles') {
    return 'Paste a real article, set unlock and steer pricing, then let readers pay to branch their own angle.'
  }
  if (section === 'Live video') {
    return 'Connect a Daily room or auto-create one, then let viewers pay to steer prompts, questions, and direction.'
  }
  if (section === 'Story seeds') {
    return 'Create story worlds that supporters can branch into their own AI storyboard-video scenarios.'
  }
  return 'Pick the exact media format you want to launch. Each category has its own focused setup.'
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}
