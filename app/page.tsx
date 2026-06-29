'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import AccountPanel from '@/components/AccountPanel'
import { EXPERIENCE_FORMATS } from '@/lib/experience-formats'

const tickerItems = [
  'Create a match room',
  'Share the supporter link',
  'Supporters get Circle wallets',
  'USDC streams pick the tactic',
  'Claude reacts to the money signal',
  'SSE pushes every live update',
]

export default function Home() {
  const router = useRouter()
  const [joinId, setJoinId] = useState('')

  function handleJoin() {
    const raw = joinId.trim()
    if (!raw) return
    const match = raw.match(/\/session\/([^/?#]+)/)
    router.push(`/session/${match?.[1] ?? raw}`)
  }

  return (
    <main className="gaffer-shell min-h-screen overflow-hidden">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/85 px-5 py-3.5 backdrop-blur-md sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded bg-[var(--pitch-green)]">
            <span className="size-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-sm font-semibold tracking-tight">GAFFER</span>
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex">
          <a href="#how" className="hover:text-zinc-950">How it works</a>
          <a href="#formats" className="hover:text-zinc-950">Formats</a>
          <a href="#ledger" className="hover:text-zinc-950">Provenance</a>
          <Link href="/profile" className="hover:text-zinc-950">Profile</Link>
        </div>
        <Link
          href="/studio"
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-50 transition active:scale-95"
        >
          Join Match
        </Link>
      </nav>

      <section className="relative px-5 pb-12 pt-16 sm:px-8 sm:pt-20 lg:px-12">
        <div className="hero-wash" />
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="rise-in inline-flex items-center gap-2 rounded-full border border-zinc-300/80 bg-white/75 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600 backdrop-blur">
            <span className="relative grid size-1.5 place-items-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--pitch-green)] opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--pitch-green)]" />
            </span>
            Real Arc Testnet payments - no demo balances
          </div>

          <h1 className="rise-in mt-5 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight text-zinc-950 sm:text-7xl lg:text-[88px]">
            The crowd <span className="italic text-[var(--pitch-green)]">runs</span>{' '}
            the show.
          </h1>
          <p className="rise-in mt-6 max-w-[52ch] text-base leading-relaxed text-zinc-600 sm:text-lg">
            Fans stream test USDC to steer the decision, an AI agent reads the
            money signal, the match reacts live, and every call is saved as
            provenance.
          </p>

          <div className="rise-in mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--pitch-green)] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/20 transition active:scale-[0.98]"
            >
              Host a match <span aria-hidden>-&gt;</span>
            </Link>
            <button
              onClick={handleJoin}
              className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-zinc-950 ring-1 ring-black/10 transition active:scale-[0.98]"
            >
              Join as supporter
            </button>
          </div>

          <dl className="rise-in mt-14 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-zinc-200/90 pt-8 sm:grid-cols-4">
            <Stat label="Per tap" value="$0.0001" />
            <Stat label="Chain" value="Arc" />
            <Stat label="Wallets" value="Circle" />
            <Stat label="Updates" value="SSE" />
          </dl>
        </div>
      </section>

      <section className="px-4 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="live-card p-1">
            <div className="rounded-[20px] bg-zinc-900 p-5 text-white sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <ClubBadge code="CWD" name="The Crowd FC" />
                <div className="flex flex-col items-center">
                  <span className="font-mono text-xs font-medium text-[var(--accent)]">
                    00:00
                  </span>
                  <span className="mt-1 text-4xl font-medium tabular-nums sm:text-5xl">
                    0<span className="mx-2 text-zinc-600">-</span>0
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Pre-match
                  </span>
                </div>
                <ClubBadge code="ALG" name="Algorithm Utd" />
              </div>

              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                      Decision window ready
                    </span>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">30s</span>
                </div>
                <h2 className="text-lg font-medium sm:text-xl">
                  How should the crowd set up?
                </h2>
                <div className="mt-4 space-y-3">
                  <LiveOption
                    title="High press"
                    detail="Force the error high up"
                    amount="0.0000 USDC"
                    width="50%"
                    active
                  />
                  <LiveOption
                    title="Park the bus"
                    detail="Defend the lead deeply"
                    amount="0.0000 USDC"
                    width="50%"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3 rounded-xl bg-zinc-800/45 p-3.5 ring-1 ring-white/5">
                <div
                  className="size-10 shrink-0 rounded-full bg-cover bg-center ring-1 ring-[var(--accent)]/40"
                  style={{ backgroundImage: 'url(/gaffer-portrait.jpg)' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">The Gaffer</span>
                    <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent)]">
                      Decisive
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                    Once supporters stream USDC, I read the signal and make the
                    tactical call. Until then, nothing is counted.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-black/40 p-3 ring-1 ring-white/5">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Fan room
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-300">
                    Create a room to generate a real session link
                  </p>
                </div>
                <Link
                  href="/studio"
                  className="inline-flex shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white ring-1 ring-white/10 hover:bg-white/15"
                >
                  Create yours
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14 overflow-hidden border-y border-zinc-200 bg-white py-3.5">
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap px-5">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <div key={`${item}-${index}`} className="flex shrink-0 items-center gap-2.5">
              <span className="text-xs font-medium uppercase tracking-tight text-zinc-700">
                {item}
              </span>
              <span className="size-1.5 rounded-full bg-zinc-300" />
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              The product loop
            </p>
            <h2 className="mt-4 max-w-[12ch] text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Stream money. Move the show.
            </h2>
          </div>
          <div className="space-y-4">
            <Step n="01" title="Creator opens a live room" body="Pick football, esports, storytelling, reality, fantasy watch party, or any crowd-steered format." />
            <Step n="02" title="Supporters stream into options" body="Tiny USDC streams become a weighted signal instead of a throwaway poll." />
            <Step n="03" title="The AI manager responds" body="The agent reads the signal, applies a decision, and records the full timeline." />
          </div>
        </div>
      </section>

      <section id="formats" className="bg-zinc-950 px-5 py-20 text-zinc-100 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Not just football
            </p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Format templates. One steering mechanic.
            </h2>
            <p className="mt-6 max-w-[52ch] text-zinc-400">
              Gaffer is the front-end spectacle. Underneath it, payment streams
              become structured intent, agent decisions, and replayable
              provenance.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Available room formats
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Real sessions only
              </span>
            </div>
            <ul className="mt-5 divide-y divide-white/5">
              {EXPERIENCE_FORMATS.map((format, index) => (
                <li key={format.id} className="flex items-start gap-4 py-3.5">
                  <span className="mt-0.5 font-mono text-[10px] text-zinc-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-100">{format.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400/80">
                        {format.status === 'live' ? 'Playable' : 'Queued'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                      {format.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="ledger" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Provenance layer
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every decision gets a receipt.
            </h2>
            <p className="mt-5 max-w-[54ch] leading-relaxed text-zinc-600">
              Each window, stream, signal change, AI response, outcome, and
              reversal becomes an auditable event. That is the trust layer
              judges can inspect after the spectacle ends.
            </p>
          </div>
          <AccountPanel />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--pitch-green)] px-5 py-20 text-white sm:px-8 lg:px-12">
        <Image
          src="/stadium-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Kick off a room. Let the crowd manage.
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-white/75">
            Spin up a session, share the fan-room link, and watch the money
            signal turn into live decisions.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/studio"
              className="inline-flex rounded-lg bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-[var(--pitch-deep)] shadow-lg shadow-black/30"
            >
              Host a match
            </Link>
            <div className="flex w-full max-w-md gap-2 sm:w-auto">
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Paste room link"
                className="min-w-0 flex-1 rounded-lg bg-white/10 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/20 placeholder:text-white/45"
              />
              <button
                onClick={handleJoin}
                disabled={!joinId.trim()}
                className="rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 disabled:opacity-45"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-xl font-medium tracking-tight text-zinc-950 sm:text-2xl">
        {value}
      </dd>
    </div>
  )
}

function ClubBadge({ code, name }: { code: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="grid size-12 place-items-center rounded-full bg-zinc-800 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 outline outline-1 -outline-offset-1 outline-white/10">
        {code}
      </div>
      <span className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {name}
      </span>
    </div>
  )
}

function LiveOption({
  title,
  detail,
  amount,
  width,
  active,
}: {
  title: string
  detail: string
  amount: string
  width: string
  active?: boolean
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-4 ring-1 ${active ? 'bg-zinc-800 ring-white/10' : 'bg-zinc-800/50 ring-white/5'}`}>
      <div className="relative z-10 flex items-center justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${active ? 'text-white' : 'text-zinc-300'}`}>
            {title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{detail}</p>
        </div>
        <span className={`shrink-0 font-mono text-sm font-medium tabular-nums ${active ? 'text-[var(--accent)]' : 'text-zinc-500'}`}>
          {amount}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
        <div
          className={active ? 'h-full bg-[var(--accent)]' : 'h-full bg-zinc-600'}
          style={{ width }}
        />
      </div>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t border-zinc-200 pt-4">
      <span className="font-mono text-[10px] text-zinc-400">{n}</span>
      <h3 className="mt-2 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{body}</p>
    </div>
  )
}
