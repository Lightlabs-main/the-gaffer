'use client'

import { useState } from 'react'
import { shortAddress } from '@/lib/client-profile'

interface Props {
  address: string | null
  status: 'loading' | 'ready' | 'error'
  totalEarned: number
  error?: string | null
  gatewayReady?: boolean
  preparingGateway?: boolean
  onPrepareGateway?: () => void
}

export default function WalletStatus({
  address,
  status,
  totalEarned,
  error,
  gatewayReady = false,
  preparingGateway = false,
  onPrepareGateway,
}: Props) {
  const [copied, setCopied] = useState(false)

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="match-panel w-full px-3 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="font-semibold uppercase tracking-wider text-zinc-950">
          Your player wallet
        </div>
        <div
          className={`h-2 w-2 rounded-full ${
            status === 'ready'
              ? 'bg-[var(--pitch-green)]'
              : status === 'loading'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
          }`}
        />
      </div>
      {status === 'loading' && (
        <span className="text-zinc-400">Creating your player wallet...</span>
      )}
      {status === 'ready' && address && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={copyAddress}
              className="font-mono text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-[var(--pitch-green)]"
              title="Copy your player wallet address"
            >
              {copied ? 'address copied' : shortAddress(address)}
            </button>
            <span className="text-zinc-500">click to copy</span>
          </div>
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-zinc-600">
            {gatewayReady
              ? 'Gateway ready for streaming.'
              : 'Fund this wallet with Arc Testnet USDC, then prepare it for streaming.'}
          </div>
          {!gatewayReady && onPrepareGateway && (
            <button
              onClick={onPrepareGateway}
              disabled={preparingGateway}
              className="mt-2 w-full rounded-lg border border-[var(--pitch-dim)] px-3 py-2 font-semibold text-[var(--pitch-green)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {preparingGateway ? 'Preparing Gateway...' : 'Prepare for streaming'}
            </button>
          )}
        </div>
      )}
      {status === 'error' && (
        <span className="text-red-400">{error || 'Wallet error'}</span>
      )}
      <div className="mt-3 border-t border-zinc-200 pt-2 font-mono text-[var(--pitch-dim)]">
        Creator earned in this match: {totalEarned.toFixed(4)} USDC
      </div>
    </div>
  )
}
