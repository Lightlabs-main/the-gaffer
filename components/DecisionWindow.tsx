'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import StreamingBar from './StreamingBar'

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

interface Props {
  decision: Decision | null
  sessionId: string
  participantWalletId: string | null
  walletReady: boolean
}

export default function DecisionWindow({
  decision,
  sessionId,
  participantWalletId,
  walletReady,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [streamingOptionId, setStreamingOptionId] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!decision || !decision.isOpen) {
      const clearTimer = window.setTimeout(() => setSecondsLeft(0), 0)
      return () => window.clearTimeout(clearTimer)
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((decision.closesAt - Date.now()) / 1000))
      setSecondsLeft(left)
    }
    update()
    const timer = setInterval(update, 250)
    return () => clearInterval(timer)
  }, [decision])

  const stopStreaming = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
    setStreamingOptionId(null)
  }, [])

  const startStreaming = useCallback(
    (optionId: string) => {
      if (!participantWalletId || !walletReady || !decision?.isOpen) return
      stopStreaming()
      setStreamError(null)
      setStreamingOptionId(optionId)

      // Send a tap immediately
      void sendTap(sessionId, optionId, participantWalletId).then((error) => {
        if (error) {
          setStreamError(error)
          stopStreaming()
        }
      })

      // Then every 500ms while holding
      streamIntervalRef.current = setInterval(() => {
        if (!decision.isOpen) {
          stopStreaming()
          return
        }
        void sendTap(sessionId, optionId, participantWalletId).then((error) => {
          if (error) {
            setStreamError(error)
            stopStreaming()
          }
        })
      }, 500)
    },
    [participantWalletId, walletReady, decision, sessionId, stopStreaming],
  )

  // Clean up on unmount or decision close
  useEffect(() => {
    if (!decision?.isOpen) {
      const timer = window.setTimeout(stopStreaming, 0)
      return () => window.clearTimeout(timer)
    }
    return stopStreaming
  }, [decision?.isOpen, stopStreaming])

  if (!decision) return null

  const totalAll = decision.options.reduce((s, o) => s + o.totalStreamed, 0)

  if (!decision.isOpen) {
    return (
      <div className="match-panel w-full p-4 text-center text-sm text-zinc-500">
        Window closed - waiting for the gaffer...
      </div>
    )
  }

  return (
    <div className="live-card w-full p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          {decision.type}
        </span>
        <span className="font-mono text-sm font-semibold text-[var(--accent)]">
          {secondsLeft}s
        </span>
      </div>
      <div className="mb-4 text-lg font-semibold text-white">{decision.prompt}</div>
      <div className="flex flex-col gap-3">
        {decision.options.map((opt, i) => (
          <StreamingBar
            key={opt.id}
            label={opt.label}
            description={opt.description}
            totalStreamed={opt.totalStreamed}
            percentage={totalAll > 0 ? (opt.totalStreamed / totalAll) * 100 : 50}
            color={i === 0 ? 'var(--bar-a)' : 'var(--bar-b)'}
            isStreaming={streamingOptionId === opt.id}
            onHoldStart={() => startStreaming(opt.id)}
            onHoldEnd={stopStreaming}
            disabled={!walletReady || !participantWalletId}
          />
        ))}
      </div>
      {!walletReady && (
        <div className="mt-2 text-center text-xs text-zinc-500">
          Fund and prepare your wallet before streaming.
        </div>
      )}
      {streamError && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {streamError}
        </div>
      )}
    </div>
  )
}

async function sendTap(
  sessionId: string,
  optionId: string,
  participantWalletId: string,
): Promise<string | null> {
  try {
    const res = await fetch('/api/decision/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, optionId, participantWalletId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return data.error || data.message || `Stream failed (${res.status})`
    }
    return null
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Stream failed'
  }
}
