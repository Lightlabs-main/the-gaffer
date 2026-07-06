'use client'

interface ProvenanceEvent {
  id: string
  ts: number
  minute: number
  category: string
  title: string
  detail: string
  data?: {
    settlementId?: string
    settlementMode?: string
    network?: string
    transactionId?: string
    txHash?: string
    route?: string
  }
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
  access: 'ACCESS',
  branch: 'BRANCH',
}

export default function ProvenancePanel({ events, compact = false }: Props) {
  const sorted = [...events].sort((a, b) => b.ts - a.ts).slice(0, compact ? 5 : 12)

  return (
    <section className="rounded-sm border border-rule bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
            Provenance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            Decision history
          </h2>
        </div>
        <span className="rounded-full border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {events.length} records
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Audit records appear as the crowd streams, windows close, and the AI
          manager responds.
        </p>
      ) : (
        <div className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {sorted.map((event) => (
            <article
              key={event.id}
              className="rounded-sm border border-rule bg-secondary px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-accent">
                  {CATEGORY_LABELS[event.category] ?? event.category.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] text-ink-muted">
                  {event.minute}&apos; - {new Date(event.ts).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">{event.title}</div>
              <p className="mt-1 text-xs leading-5 text-ink-muted">{event.detail}</p>
              {event.data?.settlementId && (
                <div className="mt-2 rounded-sm border border-rule bg-card px-2 py-1 font-mono text-[10px] leading-4 text-ink-muted">
                  <div>
                    {event.data.settlementMode ?? 'settlement'} -{' '}
                    {event.data.network ?? 'arc'}
                  </div>
                  <div className="truncate">
                    tx:{' '}
                    {event.data.txHash ??
                      event.data.transactionId ??
                      event.data.settlementId}
                  </div>
                  {event.data.route && (
                    <div className="truncate">route: {event.data.route}</div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
