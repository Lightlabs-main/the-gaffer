'use client'

interface Props {
  address: string | null
  status: 'loading' | 'ready' | 'error'
  totalEarned: number
  error?: string | null
}

export default function WalletStatus({
  address,
  status,
  totalEarned,
  error,
}: Props) {
  return (
    <div className="w-full flex items-center justify-between rounded-lg border border-zinc-800/50 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            status === 'ready'
              ? 'bg-[var(--pitch-green)]'
              : status === 'loading'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
          }`}
        />
        {status === 'loading' && (
          <span className="text-zinc-400">Setting up wallet...</span>
        )}
        {status === 'ready' && address && (
          <span className="font-mono text-zinc-500">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-400">{error || 'Wallet error'}</span>
        )}
      </div>
      <div className="font-mono text-[var(--pitch-dim)]">
        {totalEarned.toFixed(4)} USDC earned
      </div>
    </div>
  )
}
