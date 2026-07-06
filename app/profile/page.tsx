import Link from 'next/link'
import { cookies } from 'next/headers'
import CircleAccountPanel from '@/components/CircleAccountPanel'
import ProfilePanel from '@/components/ProfilePanel'
import type { ProfileIdentity } from '@/lib/client-profile'

function parseProfileIdentityCookie(value?: string): ProfileIdentity | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const initialIdentity = parseProfileIdentityCookie(
    cookieStore.get('gaffer_profile_identity')?.value,
  )

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic tracking-tight">Gaffer</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted sm:inline">
              Profile - Wallet - Rooms
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="hidden rounded-full border border-rule px-4 py-1.5 text-xs font-medium text-ink hover:bg-secondary sm:inline-flex"
            >
              Studio
            </Link>
            <Link
              href="/"
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:opacity-90"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-baseline gap-4 px-4 py-3 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Account
          </span>
          <span className="truncate text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Sign in - Gaffer wallet - Room history
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            USDC
          </span>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
          Section P - Creator identity
        </p>
        <div className="mt-4 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7">
            <h1 className="font-serif text-5xl leading-[0.95] sm:text-6xl">
              Your Gaffer profile.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Sign in once, create or join rooms, and track every paid steer.
              The product now shows one visible Circle Arc wallet for login,
              unlocks, steers, and payouts.
            </p>
          </div>
          <aside className="col-span-12 rounded-sm border border-rule bg-ink p-5 text-paper lg:col-span-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/60">
              Wallet model
            </p>
            <h2 className="mt-2 font-serif text-3xl">One wallet on screen.</h2>
            <p className="mt-3 text-sm leading-relaxed text-paper/70">
              Email signup creates a Circle wallet on Arc Testnet. Gaffer uses
              that wallet for paid rooms, audience steers, and creator payouts.
            </p>
          </aside>
        </div>

        <div className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7">
            <CircleAccountPanel initialIdentity={initialIdentity} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <ProfilePanel initialIdentity={initialIdentity} />
          </div>
        </div>
      </section>
    </main>
  )
}
