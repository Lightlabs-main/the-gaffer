'use client'

import Link from 'next/link'
import AccountPanel from '@/components/AccountPanel'
import ProfilePanel from '@/components/ProfilePanel'

export default function ProfilePage() {
  return (
    <main className="gaffer-shell min-h-screen px-4 py-6 text-zinc-950">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pitch-dim)]">
              The Gaffer
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Your Match Profile</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-[var(--pitch-green)]/60"
          >
            Home
          </Link>
        </div>
        <AccountPanel />
        <ProfilePanel />
      </div>
    </main>
  )
}
