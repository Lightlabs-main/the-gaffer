'use client'

interface MatchEvent {
  id: string
  minute: number
  type: string
  text: string
  isGoal?: boolean
}

interface TeamState {
  name: string
  score: number
  formation: string
  mentality?: string
  pressing?: string
}

interface DecisionOption {
  id: string
  label: string
  totalStreamed: number
}

interface Decision {
  options: DecisionOption[]
  isOpen: boolean
}

interface Props {
  minute: number
  status: string
  homeTeam: TeamState
  awayTeam: TeamState
  events: MatchEvent[]
  currentDecision?: Decision
}

const HOME_PLAYERS = [
  { n: 'GK', x: 10, y: 50, d: 0 },
  { n: 'LB', x: 25, y: 20, d: 1 },
  { n: 'CB', x: 24, y: 40, d: 2 },
  { n: 'CB', x: 24, y: 60, d: 3 },
  { n: 'RB', x: 25, y: 80, d: 4 },
  { n: 'CM', x: 43, y: 32, d: 5 },
  { n: 'CM', x: 43, y: 50, d: 6 },
  { n: 'CM', x: 43, y: 68, d: 7 },
  { n: 'LW', x: 64, y: 24, d: 8 },
  { n: 'ST', x: 70, y: 50, d: 9 },
  { n: 'RW', x: 64, y: 76, d: 10 },
]

const AWAY_PLAYERS = [
  { n: 'GK', x: 90, y: 50, d: 0 },
  { n: 'LB', x: 76, y: 20, d: 1 },
  { n: 'CB', x: 77, y: 40, d: 2 },
  { n: 'CB', x: 77, y: 60, d: 3 },
  { n: 'RB', x: 76, y: 80, d: 4 },
  { n: 'CM', x: 58, y: 32, d: 5 },
  { n: 'CM', x: 58, y: 50, d: 6 },
  { n: 'CM', x: 58, y: 68, d: 7 },
  { n: 'LW', x: 38, y: 24, d: 8 },
  { n: 'ST', x: 32, y: 50, d: 9 },
  { n: 'RW', x: 38, y: 76, d: 10 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function eventBias(events: MatchEvent[]): { x: number; y: number; label: string } {
  const latest = events.at(-1)
  if (!latest) return { x: 50, y: 50, label: 'Building from midfield' }
  if (latest.type === 'goal') return { x: 84, y: 50, label: 'Crowd FC attack' }
  if (latest.type === 'goal-conceded') return { x: 16, y: 50, label: 'Under pressure' }
  if (latest.type === 'chance') return { x: 72, y: 38, label: 'Chance developing' }
  if (latest.type === 'card') return { x: 48, y: 64, label: 'Tempers rising' }
  return { x: 52, y: 50, label: 'Live passage' }
}

function phase(minute: number, seed: number): number {
  return ((minute * 19 + seed * 37) % 100) / 100
}

export default function LivePlayerStream({
  minute,
  status,
  homeTeam,
  awayTeam,
  events,
  currentDecision,
}: Props) {
  const latestEvents = events.slice(-4).reverse()
  const bias = eventBias(events)
  const totalStreamed =
    currentDecision?.options.reduce((sum, option) => sum + option.totalStreamed, 0) ?? 0
  const leadingOption = currentDecision?.options.reduce<DecisionOption | null>(
    (leader, option) => (!leader || option.totalStreamed > leader.totalStreamed ? option : leader),
    null,
  )
  const tempo =
    homeTeam.mentality === 'attacking'
      ? 'High tempo'
      : homeTeam.mentality === 'defensive'
        ? 'Low block'
        : 'Balanced shape'

  return (
    <section className="match-panel overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-emerald-900/20 bg-gradient-to-r from-emerald-950 via-teal-900 to-zinc-950 px-4 py-3 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-yellow-300">
            Live Player Stream
          </p>
          <h2 className="text-base font-semibold text-white">
            {tempo} - {bias.label}
          </h2>
        </div>
        <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs text-yellow-200 shadow-lg shadow-emerald-950/40">
          {minute}&apos; {status}
        </div>
      </div>

      <div className="live-pitch relative h-[360px] overflow-hidden sm:h-[420px]">
        <div className="crowd-ribbon crowd-ribbon-top" />
        <div className="crowd-ribbon crowd-ribbon-bottom" />
        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
          Broadcast cam
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-red-400/30 bg-red-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-100 backdrop-blur">
          Live
        </div>
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
        <div className="absolute left-3 top-1/2 h-36 w-16 -translate-y-1/2 border border-white/25" />
        <div className="absolute right-3 top-1/2 h-36 w-16 -translate-y-1/2 border border-white/25" />

        <div
          className="live-ball"
          style={{
            left: `${bias.x}%`,
            top: `${bias.y}%`,
          }}
        />

        {HOME_PLAYERS.map((player) => {
          const drift = phase(minute, player.d)
          const press = homeTeam.pressing === 'high' ? 5 : homeTeam.pressing === 'low' ? -4 : 0
          const attack = homeTeam.mentality === 'attacking' ? 5 : homeTeam.mentality === 'defensive' ? -5 : 0
          return (
            <div
              key={`home-${player.n}-${player.d}`}
              className="live-player live-player-home"
              style={{
                left: `${clamp(player.x + press + attack + (drift - 0.5) * 4, 5, 86)}%`,
                top: `${clamp(player.y + Math.sin((minute + player.d) / 2) * 5, 8, 92)}%`,
                animationDelay: `${player.d * -0.14}s`,
              }}
            >
              {player.n}
            </div>
          )
        })}

        {AWAY_PLAYERS.map((player) => {
          const drift = phase(minute, player.d + 12)
          return (
            <div
              key={`away-${player.n}-${player.d}`}
              className="live-player live-player-away"
              style={{
                left: `${clamp(player.x + (drift - 0.5) * 4, 14, 95)}%`,
                top: `${clamp(player.y + Math.cos((minute + player.d) / 2) * 5, 8, 92)}%`,
                animationDelay: `${player.d * -0.12}s`,
              }}
            >
              {player.n}
            </div>
          )
        })}

        <div className="absolute bottom-3 left-3 right-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-yellow-300/25 bg-emerald-950/70 p-3 text-xs text-white shadow-xl shadow-emerald-950/40 backdrop-blur">
            <div className="font-semibold">{homeTeam.name}</div>
            <div className="mt-1 text-white/70">
              {homeTeam.formation} - {homeTeam.mentality} - {homeTeam.pressing} press
            </div>
          </div>
          <div className="rounded-lg border border-sky-300/25 bg-sky-950/65 p-3 text-xs text-white shadow-xl shadow-sky-950/30 backdrop-blur">
            <div className="font-semibold">{awayTeam.name}</div>
            <div className="mt-1 text-white/70">{awayTeam.formation}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-emerald-900/20 sm:grid-cols-[1fr_220px]">
        <div className="bg-gradient-to-br from-white via-emerald-50 to-yellow-50 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Live Feed
          </div>
          <div className="flex flex-col gap-2">
            {latestEvents.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm">
                Waiting for kickoff events.
              </div>
            ) : (
              latestEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">
                  <span className="mr-2 font-mono text-xs text-[var(--pitch-dim)]">{event.minute}&apos;</span>
                  {event.text}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 via-white to-sky-50 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Money Signal
          </div>
          <div className="font-mono text-2xl font-semibold text-emerald-700">
            {totalStreamed.toFixed(4)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">USDC in current window</div>
          <div className="mt-3 rounded-lg border border-yellow-200 bg-white p-2 text-xs text-zinc-600 shadow-sm">
            {leadingOption && totalStreamed > 0
              ? `${leadingOption.label} is leading the steering signal.`
              : 'No paid steering signal yet.'}
          </div>
        </div>
      </div>
    </section>
  )
}
