'use client'

interface Props {
  homeName: string
  homeScore: number
  awayName: string
  awayScore: number
  minute: number
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  'pre-match': 'PRE-MATCH',
  'first-half': '1ST HALF',
  'half-time': 'HALF TIME',
  'second-half': '2ND HALF',
  'full-time': 'FULL TIME',
}

export default function Scoreboard({
  homeName,
  homeScore,
  awayName,
  awayScore,
  minute,
  status,
}: Props) {
  return (
    <div className="live-card field-lines w-full p-5 text-center">
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <div className="flex-1 text-right">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-200 sm:text-base">
            {homeName}
          </div>
        </div>
        <div className="rounded-xl bg-black/70 px-4 py-2 font-mono text-4xl font-semibold tracking-wider shadow-lg">
          <span>{homeScore}</span>
          <span className="mx-2 text-xl text-zinc-500">-</span>
          <span>{awayScore}</span>
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:text-base">
            {awayName}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
        <span className="font-mono text-[var(--accent)]">{minute}&apos;</span>
        <span className="text-zinc-500">{STATUS_LABELS[status] ?? status}</span>
      </div>
    </div>
  )
}
