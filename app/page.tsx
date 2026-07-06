import Image from 'next/image'
import Link from 'next/link'

const rooms = [
  {
    href: '/session/transfer-deadline',
    image: '/room-transfer.jpg',
    title: 'Transfer Deadline, Directed by You',
    host: 'Fabrizio Romani',
    kind: 'Live Video',
    meta: '2.1k watching',
    pool: '3,904',
    price: '0.50',
    live: true,
    large: true,
  },
  {
    href: '/session/the-lagos-article',
    image: '/room-article.jpg',
    title: 'The Lagos Article: Rewrite the Ending',
    host: 'Amara Okafor',
    kind: 'Article',
    meta: '120 branches',
    pool: '418',
    price: '0.25',
  },
  {
    href: '/session/the-last-bureau',
    image: '/room-story.jpg',
    title: 'Story Seed: The Last Bureau',
    host: 'Julian Vane',
    kind: 'Story',
    meta: '45 branches',
    pool: '612',
    price: '1.00',
  },
  {
    href: '/session/no-script-tonight',
    image: '/room-live.jpg',
    title: 'Late Show / No Script Tonight',
    host: 'Kenji Aoki',
    kind: 'Live Video',
    meta: '612 watching',
    pool: '220',
    price: '0.25',
    live: true,
  },
  {
    href: '/session/the-kitchen',
    image: '/room-kitchen.jpg',
    title: 'The Kitchen: 12 Endings, One Service',
    host: 'Marisol Ferreira',
    kind: 'Story',
    meta: '31 branches',
    pool: '180',
    price: '0.75',
  },
]

const tickerItems = [
  ['STEER_LIVE', '"Aggressive press" - Madrid vs City', '0.25 USDC'],
  ['BRANCH_GEN', '"The Alternate Ending" - Lagos Article', '1.00 USDC'],
  ['UNLOCK', '"The Last Bureau" - Story Seed', '0.50 USDC'],
  ['STEER_LIVE', '"Focus on Haaland" - Tactics Room', '1.20 USDC'],
  ['BRANCH_GEN', '"12 Endings" - The Kitchen', '0.75 USDC'],
  ['UNLOCK', '"No Script Tonight" - Late Show', '0.10 USDC'],
]

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic tracking-tight">Gaffer</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted sm:inline">
              Paid Interactive Media - No. 001
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="#formats"
              className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted hover:text-ink sm:inline"
            >
              Formats
            </Link>
            <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted md:flex">
              <span className="size-1.5 rounded-full bg-accent" />
              Systems on air
            </span>
            <Link
              href="/studio"
              className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:opacity-90"
            >
              Enter the Studio
            </Link>
          </nav>
        </div>
      </header>

      <div className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-baseline gap-4 px-4 py-3 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Vol. I
          </span>
          <span className="truncate text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Live rooms - Articles - Story seeds - Football
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            USDC
          </span>
        </div>
      </div>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Issue 001 - The audience is now the director
          </p>
          <div className="mt-6 grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-7">
              <h1 className="text-balance font-serif text-[2.5rem] leading-[1.02] sm:text-6xl md:text-[5rem] md:leading-[0.95]">
                Media you don&apos;t just consume.{' '}
                <span className="italic text-accent">You direct.</span>
              </h1>
              <div className="mt-6 grid grid-cols-1 gap-6 border-t border-rule pt-6 sm:grid-cols-2">
                <p className="text-pretty text-[15px] leading-relaxed text-ink">
                  Creators publish a seed: a live stream, an article, a story
                  world. Audiences pay tiny amounts of USDC to unlock it, then
                  pay again to steer what happens next. Every branch, every
                  prompt, every payout is recorded on Arc as provenance.
                </p>
                <p className="text-pretty text-sm leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">Wallets are silent.</span>{' '}
                  Log in with email. Circle creates the
                  settlement wallet. The audience just sees a button that says{' '}
                  <em>steer</em>, and the story bends.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 rounded-sm bg-ink px-5 py-3 text-sm font-medium text-paper hover:opacity-90"
                >
                  Enter the Studio <span aria-hidden>→</span>
                </Link>
                <Link
                  href="#live"
                  className="inline-flex items-center gap-2 rounded-sm border border-rule bg-paper px-5 py-3 text-sm font-medium text-ink hover:bg-secondary"
                >
                  Watch a live room
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                  From 0.10 USDC - no card required
                </span>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5">
              <article className="overflow-hidden rounded-sm border border-rule bg-card">
                <div className="relative">
                  <Image
                    src="/hero-tactics.jpg"
                    alt="Live tactics room broadcast"
                    width={1600}
                    height={900}
                    priority
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <LiveBadge />
                    <span className="rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur-sm">
                      842 watching
                    </span>
                  </div>
                  <div className="absolute right-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-ink">
                    Featured
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                    Tactics Room - Live Steer
                  </p>
                  <h3 className="mt-2 font-serif text-2xl leading-tight">
                    Madrid vs City: The Final Ten Minutes
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Hosted by Elias Thorne - Directed by 314 supporters
                  </p>
                  <div className="mt-4 flex items-end justify-between border-t border-rule pt-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                        Steer pool
                      </p>
                      <p className="font-mono text-lg font-medium">1,240 USDC</p>
                    </div>
                    <button className="rounded-sm bg-accent px-4 py-2 text-xs font-medium uppercase tracking-wider text-white">
                      Steer - 1.00
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-rule pt-8 md:grid-cols-4">
            <Stat label="Rooms live now" value="24" />
            <Stat label="Steers paid this week" value="18,402" />
            <Stat label="Avg. steer price" value="0.34 USDC" />
            <Stat label="Paid to creators" value="$412,908" />
          </dl>
        </div>
      </section>

      <section id="live" className="border-b border-rule bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <header className="flex items-end justify-between border-b border-rule pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
                Section A - On air
              </p>
              <h2 className="mt-2 font-serif text-3xl sm:text-5xl">
                Rooms currently steering.
              </h2>
            </div>
            <Link
              href="/studio"
              className="hidden font-mono text-[11px] uppercase tracking-widest text-ink-muted underline underline-offset-4 sm:block"
            >
              The full slate
            </Link>
          </header>

          <div className="mt-8 grid grid-cols-12 gap-6">
            <RoomCard room={rooms[0]} className="col-span-12 lg:col-span-7" />
            <div className="col-span-12 grid gap-6 lg:col-span-5">
              <RoomCard room={rooms[1]} />
              <RoomCard room={rooms[2]} />
            </div>
            <RoomCard room={rooms[3]} className="col-span-12 sm:col-span-6 lg:col-span-4" />
            <RoomCard room={rooms[4]} className="col-span-12 sm:col-span-6 lg:col-span-4" />
            <aside className="col-span-12 rounded-sm border border-rule bg-ink p-5 text-paper lg:col-span-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/60">
                Index
              </p>
              <h3 className="mt-2 font-serif text-2xl">
                Everything on air right now, by format.
              </h3>
              <ul className="mt-6 divide-y divide-white/10">
                {[
                  ['Live Video', '9 rooms'],
                  ['Articles', '12 rooms'],
                  ['Story Seeds', '6 rooms'],
                  ['Football Mode', '3 rooms'],
                ].map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between py-3">
                    <span className="text-sm">{label}</span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/studio"
                className="mt-6 inline-flex w-full items-center justify-center rounded-sm bg-paper px-4 py-2.5 text-sm font-medium text-ink"
              >
                Browse the full studio →
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-b border-rule bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/60">
            Provenance ticker - Arc / Circle
          </span>
          <div className="relative flex-1 overflow-hidden">
            <div className="gaffer-marquee flex whitespace-nowrap gap-10">
              {[...tickerItems, ...tickerItems].map(([event, text, amount], index) => (
                <span
                  key={`${event}-${text}-${index}`}
                  className="font-mono text-[11px] uppercase tracking-tight text-paper/60"
                >
                  <span className="text-accent">{event}</span> - {text} -{' '}
                  <span className="text-paper">{amount}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="formats" className="border-b border-rule bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Section B - Formats
          </p>
          <h2 className="mt-2 max-w-3xl font-serif text-4xl leading-[1] sm:text-6xl">
            One paid steering mechanic across every creator format.
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-4">
            {[
              ['01', 'Live rooms', 'Daily video embeds with paid questions, cues, and scene direction.'],
              ['02', 'Articles', 'Readers unlock the original article, then pay to generate their own branch.'],
              ['03', 'Story video', 'AI turns a creator seed and audience scenario into storyboard-video branches.'],
              ['04', 'Football', 'The original spectacle: fans steer a simulated club with tactical streams.'],
            ].map(([n, title, body]) => (
              <article key={title} className="bg-card p-5">
                <p className="font-mono text-[10px] text-accent">{n}</p>
                <h3 className="mt-8 font-serif text-2xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl grid-cols-12 items-center gap-8 px-4 py-16 sm:px-6 sm:py-20">
          <div className="col-span-12 md:col-span-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/60">
              Section E - Open the studio
            </p>
            <h2 className="mt-2 text-balance font-serif text-4xl leading-[1] sm:text-6xl">
              Publish a seed today. Get paid every time someone bends it.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper/70">
              Log in with email. Paste an article, drop a story seed, or start
              a live room. Share the link. The audience does the rest.
            </p>
          </div>
          <div className="col-span-12 flex flex-col gap-3 md:col-span-4">
            <Link
              href="/studio"
              className="w-full rounded-sm bg-paper px-5 py-4 text-center text-sm font-medium text-ink hover:opacity-90"
            >
              Enter the Studio →
            </Link>
            <Link
              href="#live"
              className="w-full rounded-sm border border-paper/30 px-5 py-4 text-center text-sm font-medium text-paper hover:bg-white/5"
            >
              Watch a live room first
            </Link>
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-paper/50">
              No wallet setup - fund with card or transfer
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-3 border-b border-rule pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-serif text-5xl italic tracking-tight">Gaffer.</p>
              <p className="mt-2 max-w-md text-sm text-ink-muted">
                Paid interactive media. Creators publish seeds; audiences pay
                USDC to unlock and steer where they go next.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              All systems operational
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ['Studio', 'Live rooms', 'Articles', 'Story seeds', 'Football mode'],
              ['Creators', 'Start a room', 'Payouts', 'Analytics', 'Guidelines'],
              ['Provenance', 'Ledger', 'Explorer', 'How Arc works', 'Circle wallets'],
              ['Company', 'About', 'Editorial', 'Careers', 'Press'],
            ].map(([heading, ...links]) => (
              <div key={heading}>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                  {heading}
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {links.map((item) => (
                    <li key={item}>
                      <Link href="/studio" className="hover:underline underline-offset-4">
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col-reverse items-start justify-between gap-4 border-t border-rule pt-6 sm:flex-row sm:items-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              © Gaffer Media 2026 - Settled in USDC - Recorded on Arc
            </p>
            <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              <Link href="/studio">Terms</Link>
              <Link href="/studio">Privacy</Link>
              <Link href="/studio">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
      <span className="size-1.5 animate-pulse rounded-full bg-white" />
      Live
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl md:text-3xl">{value}</dd>
    </div>
  )
}

function RoomCard({
  className = '',
  room,
}: {
  className?: string
  room: (typeof rooms)[number]
}) {
  return (
    <Link
      href={room.href}
      className={`group flex flex-col overflow-hidden rounded-sm border border-rule bg-card transition-shadow hover:shadow-[0_2px_0_0_var(--ink)] ${className}`}
    >
      <div className="relative">
        <Image
          src={room.image}
          alt={room.title}
          width={800}
          height={600}
          className={`w-full object-cover ${room.large ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}
        />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {room.live ? (
            <LiveBadge />
          ) : (
            <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
              {room.kind}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          {room.kind} - {room.meta}
        </p>
        <h3 className={`font-serif leading-tight ${room.large ? 'text-3xl sm:text-4xl' : 'text-xl'}`}>
          {room.title}
        </h3>
        <p className="text-sm text-ink-muted">Hosted by {room.host}</p>
        <div className="mt-auto flex items-end justify-between border-t border-rule pt-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
              Steer pool
            </p>
            <p className="font-mono text-sm text-ink">{room.pool} USDC</p>
          </div>
          <span className="rounded-sm border border-ink bg-ink px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-paper group-hover:bg-transparent group-hover:text-ink">
            Steer - {room.price}
          </span>
        </div>
      </div>
    </Link>
  )
}
