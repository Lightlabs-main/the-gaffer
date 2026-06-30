'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import AccountPanel from '@/components/AccountPanel'
import Scoreboard from '@/components/Scoreboard'
import ManagerSpeech from '@/components/ManagerSpeech'
import DecisionWindow from '@/components/DecisionWindow'
import MatchCommentary from '@/components/MatchCommentary'
import WalletStatus from '@/components/WalletStatus'
import ProfilePanel from '@/components/ProfilePanel'
import CreatorEarnings from '@/components/CreatorEarnings'
import MatchStatusPanel from '@/components/MatchStatusPanel'
import ProvenancePanel from '@/components/ProvenancePanel'
import { readProfileIdentity, upsertProfileMatch } from '@/lib/client-profile'

interface MatchEvent {
  id: string
  minute: number
  type: string
  text: string
  isGoal?: boolean
}

interface DecisionOption {
  id: string
  label: string
  description: string
  totalStreamed: number
}

interface Decision {
  id: string
  type: string
  prompt: string
  options: DecisionOption[]
  closesAt: number
  isOpen: boolean
}

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
  events: MatchEvent[]
  currentDecision?: Decision
  totalEarned: number
}

interface Props {
  sessionId: string
}

interface ProvenanceEvent {
  id: string
  ts: number
  minute: number
  category: string
  title: string
  detail: string
}

function readStoredWallet(sessionId: string): { walletId: string; address: string } | null {
  if (typeof window === 'undefined') return null
  const storageKey = `gaffer_wallet_${sessionId}`
  const stored = localStorage.getItem(storageKey)
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as { walletId?: string; address?: string }
    if (parsed.walletId && parsed.address) {
      return { walletId: parsed.walletId, address: parsed.address }
    }
  } catch {
    localStorage.removeItem(storageKey)
  }
  return null
}

export default function MatchRoom({ sessionId }: Props) {
  const initialWallet = useMemo(() => readStoredWallet(sessionId), [sessionId])
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [connected, setConnected] = useState(false)
  const [managerSpeech, setManagerSpeech] = useState<string | null>(null)
  const [speechKey, setSpeechKey] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<'loading' | 'ready' | 'error'>(
    initialWallet ? 'ready' : 'loading',
  )
  const [walletAddress, setWalletAddress] = useState<string | null>(
    initialWallet?.address ?? null,
  )
  const [walletId, setWalletId] = useState<string | null>(
    initialWallet?.walletId ?? null,
  )
  const [walletError, setWalletError] = useState<string | null>(null)
  const [gatewayReady, setGatewayReady] = useState(false)
  const [preparingGateway, setPreparingGateway] = useState(false)
  const [matchStarted, setMatchStarted] = useState(false)
  const [creatorWalletId, setCreatorWalletId] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [provenanceEvents, setProvenanceEvents] = useState<ProvenanceEvent[]>([])
  const [authVersion, setAuthVersion] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    function onAuthChanged() {
      setAuthVersion((version) => version + 1)
    }
    window.addEventListener('gaffer-auth-changed', onAuthChanged)
    return () => window.removeEventListener('gaffer-auth-changed', onAuthChanged)
  }, [])

  // Set up participant wallet on mount
  useEffect(() => {
    const storageKey = `gaffer_wallet_${sessionId}`

    // Register the logged-in account wallet for this match.
    let cancelled = false
    async function createWallet() {
      try {
        setWalletError(null)
        if (!initialWallet) setWalletStatus('loading')
        const profile = readProfileIdentity()
        const existingWallet = profile ?? initialWallet
        const res = await fetch('/api/wallet/participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            walletId: existingWallet?.walletId,
            address: existingWallet?.address,
          }),
        })
        if (cancelled) return
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || 'Wallet creation failed')
        }
        const data = await res.json()
        const wallet = {
          walletId: data.participant.walletId,
          address: data.participant.address,
        }
        localStorage.setItem(storageKey, JSON.stringify(wallet))
        setWalletId(wallet.walletId)
        setWalletAddress(wallet.address)
        setGatewayReady(Boolean(data.participant.gatewayReady))
        setWalletStatus('ready')
        upsertProfileMatch({
          sessionId,
          role: 'participant',
          walletId: wallet.walletId,
          address: wallet.address,
          status: 'running',
        })
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Wallet error'
        setWalletError(message)
        setWalletStatus('error')
      }
    }

    void createWallet()
    return () => { cancelled = true }
  }, [sessionId, initialWallet, authVersion])

  async function prepareGateway() {
    if (!walletId || !walletAddress || preparingGateway) return
    setPreparingGateway(true)
    setWalletError(null)
    try {
      const res = await fetch('/api/wallet/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          walletId,
          address: walletAddress,
          prepareGateway: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            (data.stage ? `Gateway preparation failed at ${data.stage}` : 'Gateway preparation failed'),
        )
      }
      setGatewayReady(Boolean(data.participant.gatewayReady))
      if (!data.participant.gatewayReady) {
        setWalletError('Fund this wallet with Arc Testnet USDC before preparing Gateway.')
      }
    } catch (err: unknown) {
      setWalletError(err instanceof Error ? err.message : 'Gateway preparation failed')
    } finally {
      setPreparingGateway(false)
    }
  }

  // Handle SSE events
  const syncCreatorProfile = useCallback((nextState: MatchState) => {
    try {
      const matches = JSON.parse(
        localStorage.getItem('gaffer_profile_matches') || '[]',
      ) as Array<{ sessionId?: string; role?: string; walletId?: string }>
      const creator = matches.find(
        (m) => m.sessionId === sessionId && m.role === 'creator',
      )
      if (creator?.walletId === nextState.creatorWalletId) {
        setCreatorWalletId(creator.walletId)
        upsertProfileMatch({
          sessionId,
          role: 'creator',
          walletId: creator.walletId,
          address: nextState.creatorAddress,
          status: nextState.status === 'full-time' ? 'closed' : 'running',
          totalEarned: nextState.totalEarned,
        })
      }
    } catch {
      setCreatorWalletId(null)
    }
  }, [sessionId])

  const handleSseEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      switch (data.kind) {
        case 'hello':
          setMatchState(data.matchState)
          setProvenanceEvents(data.provenanceEvents ?? [])
          syncCreatorProfile(data.matchState)
          break

        case 'match-started':
          setMatchState(data.matchState)
          syncCreatorProfile(data.matchState)
          setMatchStarted(true)
          break

        case 'clock-tick':
          setMatchState((prev) =>
            prev ? { ...prev, minute: data.minute, status: data.status } : prev,
          )
          break

        case 'status-change':
          setMatchState((prev) =>
            prev
              ? { ...prev, status: data.status, minute: data.minute }
              : prev,
          )
          break

        case 'decision-opened':
          setMatchState((prev) =>
            prev ? { ...prev, currentDecision: data.window } : prev,
          )
          break

        case 'decision-closed':
          setMatchState((prev) =>
            prev
              ? { ...prev, currentDecision: { ...data.window, isOpen: false } }
              : prev,
          )
          break

        case 'tap':
          setMatchState((prev) => {
            if (!prev?.currentDecision) return prev
            const updatedOptions = prev.currentDecision.options.map((opt) =>
              opt.id === data.optionId
                ? { ...opt, totalStreamed: data.totalForOption }
                : opt,
            )
            return {
              ...prev,
              currentDecision: {
                ...prev.currentDecision,
                options: updatedOptions,
              },
            }
          })
          break

        case 'manager-spoke':
          setManagerSpeech(data.speech)
          setSpeechKey(data.windowId)
          if (data.tactic?.kind === 'state') {
            setMatchState((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                homeTeam: {
                  ...prev.homeTeam,
                  [data.tactic.field]: data.tactic.value,
                },
              }
            })
          }
          break

        case 'simulation':
          setMatchState((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              events: [...prev.events, ...data.events],
              homeTeam: {
                ...prev.homeTeam,
                score: data.matchState.homeTeam.score,
              },
              awayTeam: {
                ...prev.awayTeam,
                score: data.matchState.awayTeam.score,
              },
              totalEarned: data.matchState.totalEarned,
            }
          })
          break

        case 'provenance':
          setProvenanceEvents((prev) => [...prev, data.event])
          break
      }
    } catch {
      // Ignore parse errors on heartbeats / comments
    }
  }, [syncCreatorProfile])

  async function copySessionLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/session/${sessionId}`)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 1500)
  }

  // Connect to SSE
  useEffect(() => {
    let cancelled = false
    async function loadSessionBeforeStream() {
      try {
        const res = await fetch(`/api/session/${sessionId}`)
        if (cancelled) return
        if (!res.ok) {
          setSessionError(
            res.status === 404
              ? 'This match session is no longer in memory. Dev sessions disappear when the local server restarts.'
              : 'Could not load this match session.',
          )
          return
        }
        const data = await res.json()
        setMatchState(data.matchState)
        setProvenanceEvents(data.provenanceEvents ?? [])
        syncCreatorProfile(data.matchState)
      } catch {
        if (!cancelled) setSessionError('Could not connect to the match server.')
      }
    }
    void loadSessionBeforeStream()

    const es = new EventSource(`/api/match/events?sessionId=${sessionId}`)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)
    es.onmessage = handleSseEvent
    es.onerror = () => {
      setConnected(false)
      // EventSource auto-reconnects
    }

    return () => {
      cancelled = true
      es.close()
      eventSourceRef.current = null
    }
  }, [sessionId, handleSseEvent, syncCreatorProfile])

  useEffect(() => {
    if (!matchState) return
    const timer = window.setTimeout(() => syncCreatorProfile(matchState), 0)
    return () => window.clearTimeout(timer)
  }, [matchState, syncCreatorProfile])

  // Start match engine when ready (creator auto-starts)
  useEffect(() => {
    if (!matchState || matchStarted) return
    if (matchState.status !== 'pre-match') {
      const alreadyStartedTimer = window.setTimeout(() => setMatchStarted(true), 0)
      return () => window.clearTimeout(alreadyStartedTimer)
    }

    // Auto-start the match after a brief delay
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/match/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        setMatchStarted(true)
      } catch {
        // Engine might already be started by another client
        setMatchStarted(true)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [matchState, matchStarted, sessionId])

  // Loading state
  if (sessionError) {
    return (
      <div className="gaffer-shell flex min-h-screen items-center justify-center px-4 text-zinc-950">
        <div className="match-panel max-w-lg p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pitch-dim)]">
            Match unavailable
          </p>
          <h1 className="mt-2 text-2xl font-semibold">This session is gone</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{sessionError}</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-lg bg-[var(--pitch-green)] px-4 py-2 text-sm font-semibold text-white"
          >
            Create a new match
          </Link>
        </div>
      </div>
    )
  }

  if (!matchState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="text-lg font-bold text-[var(--pitch-green)]">
            The Gaffer
          </div>
          <div className="mt-2 text-sm text-zinc-500">
            {connected ? 'Loading match...' : 'Connecting...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gaffer-shell min-h-screen px-4 py-4 text-zinc-950">
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-3">
        {/* Connection status */}
        {!connected && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-center text-xs text-yellow-700">
            Reconnecting...
          </div>
        )}

        {/* Scoreboard */}
        <section className="match-panel p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--pitch-dim)]">
                Live format
              </p>
              <h1 className="mt-1 text-xl font-semibold text-zinc-950">
                {matchState.experienceLabel ?? 'Football simulation stream'}
              </h1>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              USDC-steered
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {matchState.experienceSummary ??
              'Fans stream USDC toward decisions while the AI agent responds and provenance records the signal.'}
          </p>
        </section>

        <Scoreboard
          homeName={matchState.homeTeam.name}
          homeScore={matchState.homeTeam.score}
          awayName={matchState.awayTeam.name}
          awayScore={matchState.awayTeam.score}
          minute={matchState.minute}
          status={matchState.status}
        />

        {/* Formation/tactic display */}
        <div className="match-panel flex items-center justify-center gap-4 px-3 py-2 text-xs text-zinc-600">
          <span>{matchState.homeTeam.formation}</span>
          <span className="text-zinc-700">|</span>
          <span>{matchState.homeTeam.mentality}</span>
          <span className="text-zinc-700">|</span>
          <span>{matchState.homeTeam.pressing} press</span>
        </div>

        <MatchStatusPanel
          minute={matchState.minute}
          status={matchState.status}
          hasOpenDecision={Boolean(matchState.currentDecision?.isOpen)}
        />

        {/* Manager Speech */}
        <ManagerSpeech speech={managerSpeech} speechKey={speechKey} />

        {/* Decision Window */}
        {matchState.currentDecision && (
          <DecisionWindow
            decision={matchState.currentDecision}
            sessionId={sessionId}
            participantWalletId={walletId}
            walletReady={walletStatus === 'ready' && gatewayReady}
          />
        )}

        {/* Match Commentary */}
        <MatchCommentary events={matchState.events} />
      </div>

      <aside className="flex flex-col gap-3">
        <AccountPanel />

        <section className="match-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
            Match Link
          </h2>
          <a
            href={`/session/${sessionId}`}
            className="mt-3 block break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-[var(--pitch-green)] hover:border-[var(--pitch-green)]/60"
          >
            {typeof window === 'undefined'
              ? `/session/${sessionId}`
              : `${window.location.origin}/session/${sessionId}`}
          </a>
          <button
            onClick={copySessionLink}
            className="mt-3 w-full rounded-lg border border-[var(--pitch-dim)] px-4 py-2 text-sm font-semibold text-[var(--pitch-green)] hover:bg-[var(--pitch-green)]/10"
          >
            {copiedLink ? 'Copied session link' : 'Copy session link'}
          </button>
        </section>

        <WalletStatus
          address={walletAddress}
          status={walletStatus}
          totalEarned={matchState.totalEarned}
          error={walletError}
          gatewayReady={gatewayReady}
          preparingGateway={preparingGateway}
          onPrepareGateway={prepareGateway}
        />

        {creatorWalletId && (
          <CreatorEarnings
            sessionId={sessionId}
            creatorWalletId={creatorWalletId}
            creatorAddress={matchState.creatorAddress}
            totalEarned={matchState.totalEarned}
          />
        )}

        <ProvenancePanel events={provenanceEvents} compact />

        <ProfilePanel />
      </aside>
      </div>
    </div>
  )
}
