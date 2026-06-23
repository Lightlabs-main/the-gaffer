'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Scoreboard from '@/components/Scoreboard'
import ManagerSpeech from '@/components/ManagerSpeech'
import DecisionWindow from '@/components/DecisionWindow'
import MatchCommentary from '@/components/MatchCommentary'
import WalletStatus from '@/components/WalletStatus'

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

export default function MatchRoom({ sessionId }: Props) {
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [connected, setConnected] = useState(false)
  const [managerSpeech, setManagerSpeech] = useState<string | null>(null)
  const [speechKey, setSpeechKey] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [matchStarted, setMatchStarted] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Set up participant wallet on mount
  useEffect(() => {
    const storageKey = `gaffer_wallet_${sessionId}`
    const stored = localStorage.getItem(storageKey)

    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setWalletId(parsed.walletId)
        setWalletAddress(parsed.address)
        setWalletStatus('ready')
        return
      } catch {
        localStorage.removeItem(storageKey)
      }
    }

    // Create a new participant wallet
    let cancelled = false
    async function createWallet() {
      try {
        const res = await fetch('/api/wallet/participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
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
        setWalletStatus('ready')
      } catch (err: unknown) {
        if (cancelled) return
        setWalletError(err instanceof Error ? err.message : 'Wallet error')
        setWalletStatus('error')
      }
    }

    void createWallet()
    return () => { cancelled = true }
  }, [sessionId])

  // Handle SSE events
  const handleSseEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      switch (data.kind) {
        case 'hello':
          setMatchState(data.matchState)
          break

        case 'match-started':
          setMatchState(data.matchState)
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
      }
    } catch {
      // Ignore parse errors on heartbeats / comments
    }
  }, [])

  // Connect to SSE
  useEffect(() => {
    const es = new EventSource(`/api/match/events?sessionId=${sessionId}`)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)
    es.onmessage = handleSseEvent
    es.onerror = () => {
      setConnected(false)
      // EventSource auto-reconnects
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [sessionId, handleSseEvent])

  // Start match engine when ready (creator auto-starts)
  useEffect(() => {
    if (!matchState || matchStarted) return
    if (matchState.status !== 'pre-match') {
      setMatchStarted(true)
      return
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
    <div className="flex min-h-screen flex-col items-center bg-[var(--background)] px-4 py-4">
      <div className="w-full max-w-lg flex flex-col gap-3">
        {/* Connection status */}
        {!connected && (
          <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-2 text-center text-xs text-yellow-400">
            Reconnecting...
          </div>
        )}

        {/* Scoreboard */}
        <Scoreboard
          homeName={matchState.homeTeam.name}
          homeScore={matchState.homeTeam.score}
          awayName={matchState.awayTeam.name}
          awayScore={matchState.awayTeam.score}
          minute={matchState.minute}
          status={matchState.status}
        />

        {/* Formation/tactic display */}
        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
          <span>{matchState.homeTeam.formation}</span>
          <span className="text-zinc-700">|</span>
          <span>{matchState.homeTeam.mentality}</span>
          <span className="text-zinc-700">|</span>
          <span>{matchState.homeTeam.pressing} press</span>
        </div>

        {/* Manager Speech */}
        <ManagerSpeech speech={managerSpeech} speechKey={speechKey} />

        {/* Decision Window */}
        {matchState.currentDecision && (
          <DecisionWindow
            decision={matchState.currentDecision}
            sessionId={sessionId}
            participantWalletId={walletId}
            walletReady={walletStatus === 'ready'}
          />
        )}

        {/* Match Commentary */}
        <MatchCommentary events={matchState.events} />

        {/* Wallet Status */}
        <WalletStatus
          address={walletAddress}
          status={walletStatus}
          totalEarned={matchState.totalEarned}
          error={walletError}
        />

        {/* Share link */}
        <div className="text-center">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(
                `${window.location.origin}/session/${sessionId}`,
              )
            }}
            className="text-xs text-zinc-600 hover:text-[var(--pitch-dim)] transition-colors"
          >
            Copy session link to share
          </button>
        </div>
      </div>
    </div>
  )
}
