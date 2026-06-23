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
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!decision || !decision.isOpen) {
      setSecondsLeft(0)
      return
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
      setStreamingOptionId(optionId)

      // Send a tap immediately
      void sendTap(sessionId, optionId, participantWalletId)

      // Then every 500ms while holding
      streamIntervalRef.current = setInterval(() => {
        if (!decision.isOpen) {
          stopStreaming()
          return
        }
        void sendTap(sessionId, optionId, participantWalletId)
      }, 500)
    },
    [participantWalletId, walletReady, decision, sessionId, stopStreaming],
  )

  // Clean up on unmount or decision close
  useEffect(() => {
    if (!decision?.isOpen) stopStreaming()
    return stopStreaming
  }, [decision?.isOpen, stopStreaming])

  if (!decision) return null

  const totalAll = decision.options.reduce((s, o) => s + o.totalStreamed, 0)

  if (!decision.isOpen) {
    return (
      <div className="w-full rounded-lg border border-zinc-700/50 p-4 text-center text-sm text-zinc-500">
        Window closed — waiting for the gaffer...
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg border border-[var(--pitch-dim)]/40 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--pitch-dim)]">
          {decision.type}
        </span>
        <span className="font-mono text-sm font-bold text-[var(--pitch-green)]">
          {secondsLeft}s
        </span>
      </div>
      <div className="mb-4 text-sm font-bold">{decision.prompt}</div>
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
          Setting up your wallet — streaming will be enabled shortly...
        </div>
      )}
    </div>
  )
}

async function sendTap(
  sessionId: string,
  optionId: string,
  participantWalletId: string,
): Promise<void> {
  try {
    await fetch('/api/decision/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, optionId, participantWalletId }),
    })
  } catch {
    // Silently fail individual taps — the SSE stream shows the real totals
  }
}
