'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AccountPanel from '@/components/AccountPanel'
import ProfilePanel from '@/components/ProfilePanel'
import { upsertProfileMatch } from '@/lib/client-profile'
import {
  EXPERIENCE_FORMATS,
  getExperienceFormat,
  type ExperienceType,
} from '@/lib/experience-formats'

export default function StudioHome() {
  return <StudioHomeForm />
}

function StudioHomeForm() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [experienceType, setExperienceType] =
    useState<ExperienceType>('football-simulation')
  const selectedFormat = getExperienceFormat(experienceType)
  const [homeTeamName, setHomeTeamName] = useState<string>(selectedFormat.defaultHome)
  const [awayTeamName, setAwayTeamName] = useState<string>(selectedFormat.defaultAway)
  const [error, setError] = useState<string | null>(null)

  function chooseFormat(nextType: ExperienceType) {
    const nextFormat = getExperienceFormat(nextType)
    setExperienceType(nextType)
    setHomeTeamName(nextFormat.defaultHome)
    setAwayTeamName(nextFormat.defaultAway)
  }

  async function createMatch() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experienceType, homeTeamName, awayTeamName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to create match')
      upsertProfileMatch({
        sessionId: data.sessionId,
        role: 'creator',
        walletId: data.creator?.walletId,
        address: data.creator?.address,
        status: 'running',
        totalEarned: 0,
      })
      router.push(`/studio/${data.sessionId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create match')
      setCreating(false)
    }
  }

  return (
    <main className="gaffer-shell min-h-screen px-4 py-6 text-zinc-950 sm:px-6">
      <div className="mx-auto mb-6 flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded bg-[var(--pitch-green)]">
            <span className="size-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-sm font-semibold tracking-tight">GAFFER</span>
        </Link>
        <Link
          href="/profile"
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:text-zinc-950"
        >
          Profile
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1fr_360px]">
        <section className="relative overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-200/70 sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[url('/stadium-hero.jpg')] bg-cover bg-center opacity-10" />
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--pitch-dim)]">
                Creator Studio
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">
                Host a live room
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
                Pick a live format, log in with email to generate a Circle Arc
                wallet, then launch a room where fans stream USDC toward
                decisions. Football is the first playable template; the
                platform is bigger than football.
              </p>
            </div>
            <Link
              href="/"
              className="relative rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:text-zinc-950"
            >
              Home
            </Link>
          </div>

          <div className="mb-5 grid gap-2 md:grid-cols-2">
            {EXPERIENCE_FORMATS.map((format, index) => (
              <button
                key={format.id}
                onClick={() => chooseFormat(format.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  experienceType === format.id
                    ? 'border-[var(--pitch-green)] bg-emerald-50 shadow-sm'
                    : 'border-zinc-200 bg-zinc-50 hover:border-[var(--pitch-green)]/50 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[var(--pitch-dim)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {format.status === 'live' ? 'Playable now' : 'Coming online'}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-950">
                  {format.label}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {format.summary}
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {selectedFormat.creatorLabel}
              </span>
              <input
                value={homeTeamName}
                onChange={(e) => setHomeTeamName(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {selectedFormat.opponentLabel}
              </span>
              <input
                value={awayTeamName}
                onChange={(e) => setAwayTeamName(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
              />
            </label>
          </div>

          <button
            onClick={createMatch}
            disabled={
              creating ||
              !homeTeamName.trim() ||
              !awayTeamName.trim()
            }
            className="mt-5 w-full rounded-lg bg-[var(--pitch-green)] px-5 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? 'Creating settlement wallet and live room...'
              : `Launch ${selectedFormat.shortLabel}`}
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <AccountPanel />
          <ProfilePanel />
        </aside>
      </div>
    </main>
  )
}
