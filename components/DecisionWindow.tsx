'use client'

import { useEffect, useMemo, useState } from 'react'

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
  participantAddress?: string | null
  creatorAddress?: string | null
  walletReady: boolean
  gatewayReady: boolean
  preparingGateway?: boolean
  onPrepareGateway?: () => void
}

export default function DecisionWindow({
  decision,
  sessionId,
  participantWalletId,
  participantAddress,
  creatorAddress,
  walletReady,
  gatewayReady,
  preparingGateway = false,
  onPrepareGateway,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [steerText, setSteerText] = useState('')
  const [settlingOptionId, setSettlingOptionId] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamSuccess, setStreamSuccess] = useState<string | null>(null)

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

  const totalAll = useMemo(
    () => decision?.options.reduce((sum, option) => sum + option.totalStreamed, 0) ?? 0,
    [decision],
  )

  if (!decision) return null

  if (!decision.isOpen) {
    return (
      <div className="match-panel w-full p-4 text-center text-sm text-zinc-500">
        Decision window closed. Open paid steering when you want the next crowd signal.
      </div>
    )
  }

  const isCreatorWallet = Boolean(
    participantAddress &&
      creatorAddress &&
      participantAddress.toLowerCase() === creatorAddress.toLowerCase(),
  )
  const canSettle = Boolean(
    walletReady && gatewayReady && participantWalletId && !isCreatorWallet,
  )

  async function submitSteer(optionId: string) {
    if (!participantWalletId || !canSettle) return
    setSettlingOptionId(optionId)
    setStreamError(null)
    setStreamSuccess(null)
    const error = await sendSteer({
      sessionId,
      optionId,
      participantWalletId,
      note: steerText,
    })
    if (error) {
      setStreamError(error)
    } else {
      setStreamSuccess('0.0001 USDC steer settled and recorded in provenance.')
    }
    setSettlingOptionId(null)
  }

  return (
    <section className="live-card w-full p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Paid steering window
          </span>
          <h2 className="mt-2 text-xl font-semibold text-white">{decision.prompt}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Type your instruction, choose a side, then settle one Arc x402 steer.
          </p>
        </div>
        <span className="rounded-full border border-red-400/40 px-3 py-1 font-mono text-sm font-semibold text-[var(--accent)]">
          {secondsLeft}s
        </span>
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          Your instruction to the AI manager
        </span>
        <textarea
          value={steerText}
          onChange={(event) => setSteerText(event.target.value)}
          rows={3}
          maxLength={360}
          placeholder="Example: switch to 4-3-3, overload the left flank, and press earlier for the next five minutes."
          className="mt-2 w-full resize-none rounded-sm border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[var(--accent)]"
        />
      </label>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {decision.options.map((option, index) => {
          const percentage = totalAll > 0 ? (option.totalStreamed / totalAll) * 100 : 50
          const isBusy = settlingOptionId === option.id
          return (
            <article
              key={option.id}
              className="rounded-sm border border-zinc-700 bg-zinc-950/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-sm bg-[var(--accent)] text-xs font-bold text-black">
                      {index === 0 ? 'A' : 'B'}
                    </span>
                    <h3 className="font-semibold text-white">{option.label}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {option.description}
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-zinc-400">
                  <div>{option.totalStreamed.toFixed(4)} USDC</div>
                  <div>{percentage.toFixed(0)}%</div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.max(4, percentage)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => submitSteer(option.id)}
                disabled={!canSettle || isBusy}
                className="mt-4 w-full rounded-sm bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isBusy ? 'Settling on Arc...' : 'Settle 0.0001 USDC steer'}
              </button>
            </article>
          )
        })}
      </div>

      {!walletReady && (
        <p className="mt-3 rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          Login first so Gaffer can attach your Circle Arc wallet to this room.
        </p>
      )}
      {walletReady && !gatewayReady && (
        <div className="mt-3 rounded-sm border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-100">
          <p>
            Your wallet is funded. Prepare it once for x402 streaming, then each
            steer will settle as a real Arc payment.
          </p>
          {onPrepareGateway && (
            <button
              type="button"
              onClick={onPrepareGateway}
              disabled={preparingGateway}
              className="mt-3 rounded-sm bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-60"
            >
              {preparingGateway ? 'Preparing x402 streaming...' : 'Prepare wallet for x402 streaming'}
            </button>
          )}
        </div>
      )}
      {walletReady && gatewayReady && isCreatorWallet && (
        <p className="mt-3 rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          This wallet owns the room, so Circle blocks it from paying itself.
          Share the session link, sign in with a different reader account, and
          steer from that funded wallet to get a real settlement record.
        </p>
      )}
      {streamSuccess && (
        <p className="mt-3 rounded-sm border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
          {streamSuccess}
        </p>
      )}
      {streamError && (
        <p className="mt-3 rounded-sm border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {streamError}
        </p>
      )}
    </section>
  )
}

async function sendSteer(input: {
  sessionId: string
  optionId: string
  participantWalletId: string
  note: string
}): Promise<string | null> {
  try {
    const res = await fetch('/api/decision/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: input.sessionId,
        optionId: input.optionId,
        participantWalletId: input.participantWalletId,
        note: input.note.trim() || undefined,
      }),
    })
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? ''
      const data = contentType.includes('application/json')
        ? await res.json().catch(() => ({}))
        : {}
      const text = contentType.includes('application/json')
        ? ''
        : await res.text().catch(() => '')
      const message =
        data.reason ||
        data.error ||
        data.message ||
        (text.trim() ? text.trim().slice(0, 240) : null)
      return message ? `Steer failed (${res.status}): ${message}` : `Steer failed (${res.status})`
    }
    return null
  } catch (err: unknown) {
    return err instanceof Error ? err.message : 'Steer failed'
  }
}
