'use client'

interface Props {
  minute: number
  status: string
  hasOpenDecision: boolean
}

const DECISION_MINUTES = [10, 20, 30, 40, 55, 65, 75, 85]

export default function MatchStatusPanel({
  minute,
  status,
  hasOpenDecision,
}: Props) {
  const nextMinute = DECISION_MINUTES.find((m) => m > minute)
  const isFinished = status === 'full-time'

  let title = 'Waiting for the first crowd decision'
  let detail = 'Watch the match for now. At minute 10, a decision window opens and players can type an instruction, choose a side, and settle a 0.0001 USDC steer.'

  if (hasOpenDecision) {
    title = 'Decision window is live'
    detail = 'Type an instruction for the AI manager, choose one of the two tactic cards, then settle one real Arc x402 steer.'
  } else if (isFinished) {
    title = 'Match closed'
    detail = 'The match is over. Creator earnings stay visible in the sidebar for withdrawal checks.'
  } else if (nextMinute) {
    title = `Next crowd decision opens at ${nextMinute}'`
    detail = `${Math.max(0, nextMinute - minute)} match minutes to go. Typed steering controls appear automatically when the window opens.`
  }

  return (
    <section className="match-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pitch-dim)]">
            What is happening now
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{detail}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
          <div className="font-mono text-2xl font-semibold text-[var(--pitch-green)]">
            {minute}&apos;
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            match clock
          </div>
        </div>
      </div>
    </section>
  )
}
