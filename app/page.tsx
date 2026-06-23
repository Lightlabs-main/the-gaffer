'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to create session')
      }
      const data = await res.json()
      router.push(`/session/${data.sessionId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setCreating(false)
    }
  }

  function handleJoin() {
    const id = joinId.trim()
    if (!id) return
    router.push(`/session/${id}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-[var(--pitch-green)]">
            The Gaffer
          </h1>
          <p className="mt-3 text-xl font-bold text-zinc-200">
            The Crowd Decides.
          </p>
          <p className="mt-2 text-sm text-zinc-500 max-w-xs mx-auto">
            Live virtual football. The crowd steers the match with USDC
            micropayments. Money is the steering wheel.
          </p>
        </div>

        {/* Create */}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-lg bg-[var(--pitch-green)] px-6 py-3 text-lg font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating match...' : 'Create a match'}
        </button>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600 uppercase tracking-wider">
            or
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Join */}
        <div className="flex w-full gap-2">
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Paste session ID"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[var(--pitch-dim)] focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={!joinId.trim()}
            className="rounded-lg border border-[var(--pitch-dim)] px-6 py-3 text-sm font-bold text-[var(--pitch-green)] transition-colors hover:bg-[var(--pitch-green)]/10 disabled:opacity-30"
          >
            Join
          </button>
        </div>

        {error && (
          <div className="w-full rounded-lg border border-red-800 bg-red-900/20 p-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
