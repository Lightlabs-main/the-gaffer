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
    <div className="w-full border border-[var(--pitch-dim)]/30 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-6">
        <div className="flex-1 text-right">
          <div className="text-lg font-bold text-[var(--pitch-green)]">
            {homeName}
          </div>
        </div>
        <div className="flex items-baseline gap-3 font-mono text-4xl font-bold tracking-wider">
          <span>{homeScore}</span>
          <span className="text-xl text-zinc-500">—</span>
          <span>{awayScore}</span>
        </div>
        <div className="flex-1 text-left">
          <div className="text-lg font-bold text-zinc-400">{awayName}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
        <span className="font-mono text-[var(--pitch-green)]">
          {minute}&apos;
        </span>
        <span className="text-zinc-500">
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>
    </div>
  )
}
