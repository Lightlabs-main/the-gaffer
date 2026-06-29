'use client'

interface MatchEvent {
  id: string
  minute: number
  type: string
  text: string
  isGoal?: boolean
}

interface Props {
  events: MatchEvent[]
}

const TYPE_ICONS: Record<string, string> = {
  goal: 'GOAL',
  'goal-conceded': 'GOAL',
  chance: 'CHANCE',
  card: 'CARD',
  injury: 'INJURY',
  substitution: 'SUB',
  commentary: '',
}

export default function MatchCommentary({ events }: Props) {
  const sorted = [...events].reverse()

  if (sorted.length === 0) {
    return (
      <div className="match-panel w-full p-4 text-center text-sm text-zinc-600">
        Match events will appear here...
      </div>
    )
  }

  return (
    <div className="match-panel w-full p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Commentary
      </div>
      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {sorted.map((event) => (
          <div
            key={event.id}
            className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${
              event.isGoal
                ? 'bg-emerald-50 text-[var(--pitch-green)]'
                : 'text-zinc-700'
            }`}
          >
            <span className="shrink-0 w-8 font-mono text-xs text-zinc-500">
              {event.minute}&apos;
            </span>
            {TYPE_ICONS[event.type] && (
              <span
                className={`shrink-0 text-xs font-bold ${
                  event.isGoal ? 'text-[var(--pitch-green)]' : 'text-zinc-500'
                }`}
              >
                {TYPE_ICONS[event.type]}
              </span>
            )}
            <span className="flex-1">{event.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
