'use client'

import { proposeScoutWindow } from '@/lib/ai-scout'
import type { MatchState } from '@/lib/types'

interface Props {
  matchState: MatchState
}

export default function AIScoutPanel({ matchState }: Props) {
  const proposal = proposeScoutWindow(
    matchState,
    matchState.currentDecision?.type ?? 'pressing',
  )
  const recommended =
    proposal.recommendation === 'A' ? proposal.options[0] : proposal.options[1]

  return (
    <section className="match-panel border-[var(--accent)]/35 bg-[var(--accent)]/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--pitch-green)]">
            {proposal.agentName}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-950">
            Next tactical decision window
          </h2>
        </div>
        <span className="rounded-full border border-[var(--pitch-green)]/25 bg-white/70 px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--pitch-green)]">
          {proposal.confidence}% read
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-700">{proposal.observation}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ScoutOption
          marker="A"
          label={proposal.options[0].label}
          description={proposal.options[0].description}
          active={proposal.recommendation === 'A'}
        />
        <ScoutOption
          marker="B"
          label={proposal.options[1].label}
          description={proposal.options[1].description}
          active={proposal.recommendation === 'B'}
        />
      </div>

      <p className="mt-3 text-xs font-semibold text-[var(--pitch-green)]">
        Scout lean: Option {proposal.recommendation} · {recommended.label}
      </p>
    </section>
  )
}

function ScoutOption({
  marker,
  label,
  description,
  active,
}: {
  marker: 'A' | 'B'
  label: string
  description: string
  active: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        active
          ? 'border-[var(--pitch-green)]/35 bg-white/85'
          : 'border-zinc-200/80 bg-white/45'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid size-6 place-items-center rounded-md font-mono text-[10px] font-bold ${
            active
              ? 'bg-[var(--pitch-green)] text-white'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {marker}
        </span>
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-600">{description}</p>
    </div>
  )
}
