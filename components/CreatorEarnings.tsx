'use client'

import { useMemo, useState } from 'react'

interface Props {
  sessionId: string
  creatorWalletId: string | null
  creatorAddress: string
  totalEarned: number
}

export default function CreatorEarnings({
  sessionId,
  creatorWalletId,
  creatorAddress,
  totalEarned,
}: Props) {
  const [destinationAddress, setDestinationAddress] = useState('')
  const [amountUsdc, setAmountUsdc] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const defaultAmount = useMemo(
    () => (totalEarned > 0 ? totalEarned.toFixed(4) : '0.0000'),
    [totalEarned],
  )

  async function withdraw() {
    if (!creatorWalletId) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          creatorWalletId,
          amountUsdc: amountUsdc || defaultAmount,
          destinationAddress,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Withdraw failed')
      setStatus(`Withdrawal submitted: ${data.transactionId}`)
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : 'Withdraw failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Payouts
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            Creator earnings
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Withdraw earned USDC from the room settlement wallet.
          </p>
        </div>
        <div className="text-right font-mono text-lg font-semibold text-ink">
          {totalEarned.toFixed(4)}
          <span className="ml-1 text-xs text-ink-muted">USDC</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]">
        <input
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder="Withdrawal address"
          className="gaffer-input font-mono text-xs"
        />
        <input
          value={amountUsdc}
          onChange={(e) => setAmountUsdc(e.target.value)}
          placeholder={defaultAmount}
          className="gaffer-input font-mono text-xs"
        />
      </div>
      <button
        onClick={withdraw}
        disabled={!creatorWalletId || !destinationAddress || totalEarned <= 0 || busy}
        className="mt-3 w-full rounded-sm bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Checking Gateway balance...' : 'Withdraw earned USDC'}
      </button>
      {totalEarned <= 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Nothing to withdraw yet. Earnings appear after supporters unlock or steer this room.
        </p>
      )}
      <div className="mt-2 font-mono text-[10px] text-ink-muted">
        Creator {creatorAddress.slice(0, 6)}...{creatorAddress.slice(-4)}
      </div>
      {status && (
        <div className="mt-3 rounded-sm border border-rule bg-secondary p-2 text-xs text-ink-muted">
          {status}
        </div>
      )}
    </section>
  )
}
