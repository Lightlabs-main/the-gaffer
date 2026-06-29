'use client'

interface ProvenanceEvent {
  id: string
  ts: number
  minute: number
  category: string
  title: string
  detail: string
}

interface Props {
  events: ProvenanceEvent[]
  compact?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  session: 'MATCH',
  window: 'WINDOW',
  stream: 'STREAM',
  signal: 'SIGNAL',
  manager: 'GAFFER',
  simulation: 'SIM',
  result: 'RESULT',
  wallet: 'WALLET',
}

export default function ProvenancePanel({ events, compact = false }: Props) {
  const sorted = [...events].sort((a, b) => b.ts - a.ts).slice(0, compact ? 5 : 12)

  return (
    <section className="match-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
          Decision Provenance
        </h2>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-[10px] text-[var(--pitch-green)]">
          {events.length} records
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Audit records appear as the crowd streams, windows close, and the AI
          manager responds.
        </p>
      ) : (
        <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {sorted.map((event) => (
            <article
              key={event.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] font-black text-[var(--pitch-green)]">
                  {CATEGORY_LABELS[event.category] ?? event.category.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">
                  {event.minute}&apos; - {new Date(event.ts).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950">{event.title}</div>
              <p className="mt-1 text-xs leading-5 text-zinc-600">{event.detail}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
