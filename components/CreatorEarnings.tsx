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
    <section className="match-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
            Creator Earnings
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            This appears only for the browser that created the match.
          </p>
        </div>
        <div className="text-right font-mono text-lg font-semibold text-[var(--pitch-green)]">
          {totalEarned.toFixed(4)}
          <span className="ml-1 text-xs text-zinc-500">USDC</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]">
        <input
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder="Withdrawal address"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
        />
        <input
          value={amountUsdc}
          onChange={(e) => setAmountUsdc(e.target.value)}
          placeholder={defaultAmount}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
        />
      </div>
      <button
        onClick={withdraw}
        disabled={!creatorWalletId || !destinationAddress || totalEarned <= 0 || busy}
        className="mt-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--pitch-deep)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Checking Gateway balance...' : 'Withdraw earned USDC'}
      </button>
      {totalEarned <= 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          Nothing to withdraw yet. Earnings appear after players stream USDC during a decision window.
        </p>
      )}
      <div className="mt-2 font-mono text-[10px] text-zinc-600">
        Creator {creatorAddress.slice(0, 6)}...{creatorAddress.slice(-4)}
      </div>
      {status && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">
          {status}
        </div>
      )}
    </section>
  )
}
