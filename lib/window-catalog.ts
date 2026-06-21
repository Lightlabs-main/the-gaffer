/**
 * Decision-window schedule and catalog for The Gaffer.
 *
 * The match runs 90 match minutes. Windows open at match minutes
 * 10, 20, 30, 40, 55, 65, 75, 85 — eight in total — each staying open for
 * 30 seconds of real time. Types rotate through this sequence:
 *
 *   formation → mentality → pressing → substitution
 *     → set-piece → crisis → push-or-hold → formation
 *
 * Each window has exactly two options the crowd streams toward.
 *
 * Pure data + a tiny builder. The match engine (Phase 7) will read this
 * schedule and call openDecisionWindow on the session at the right moment.
 */
import { randomUUID } from 'node:crypto'
import type { DecisionOption, DecisionWindow } from './types'

export const WINDOW_OPEN_DURATION_MS = 30_000

export const WINDOW_MATCH_MINUTES = [10, 20, 30, 40, 55, 65, 75, 85] as const

export const WINDOW_TYPE_ROTATION = [
  'formation',
  'mentality',
  'pressing',
  'substitution',
  'set-piece',
  'crisis',
  'push-or-hold',
  'formation',
] as const satisfies readonly DecisionWindow['type'][]

/** Type for window N (0-indexed). */
export function windowTypeForIndex(i: number): DecisionWindow['type'] {
  return WINDOW_TYPE_ROTATION[i % WINDOW_TYPE_ROTATION.length]
}

/** Template — prompt + the two options' label/description. The match engine
 *  fills in fresh IDs and zero totals when actually opening a window. */
interface WindowTemplate {
  prompt: string
  options: { label: string; description: string }[]
}

const TEMPLATES: Record<DecisionWindow['type'], WindowTemplate[]> = {
  formation: [
    {
      prompt: 'Switch shape?',
      options: [
        { label: 'Switch to 4-3-3', description: 'More attackers, more risk in midfield' },
        { label: 'Hold the 4-4-2', description: 'Stay compact, soak pressure' },
      ],
    },
    {
      prompt: 'Reshape the back line?',
      options: [
        { label: 'Drop to 5-3-2', description: 'Three centre-backs, narrower' },
        { label: 'Stay at 4-4-2', description: 'Keep width and shape' },
      ],
    },
  ],
  mentality: [
    {
      prompt: 'How do we play this spell?',
      options: [
        { label: 'Attacking', description: 'Push the full-backs, hunt a goal' },
        { label: 'Defensive', description: 'Two banks of four, sit deep' },
      ],
    },
  ],
  pressing: [
    {
      prompt: 'Pressing trigger?',
      options: [
        { label: 'High press', description: 'Squeeze them in their own third' },
        { label: 'Sit off', description: 'Stay low, force them into long balls' },
      ],
    },
  ],
  substitution: [
    {
      prompt: 'Make a change?',
      options: [
        { label: 'Bring on the striker', description: 'Fresh legs up top, chase a goal' },
        { label: 'Stick with the eleven', description: "Don't break what's working" },
      ],
    },
  ],
  'set-piece': [
    {
      prompt: 'Free-kick on the edge of the box.',
      options: [
        { label: 'Shoot direct', description: 'Top-corner specialist over it' },
        { label: 'Whip it in', description: 'Aim for the big lads at the back post' },
      ],
    },
  ],
  crisis: [
    {
      prompt: 'We just conceded — react?',
      options: [
        { label: 'Throw everyone forward', description: 'All-out attack, damn the gaps' },
        { label: 'Steady the ship', description: 'Composure first, build again' },
      ],
    },
  ],
  'push-or-hold': [
    {
      prompt: 'Late on, do we go again?',
      options: [
        { label: 'Push for another', description: 'Empty the bench, chase the kill' },
        { label: 'Hold what we have', description: 'See the clock down' },
      ],
    },
  ],
}

/** Build a fresh DecisionWindow ready to push to a MatchState. */
export function buildDecisionWindow(
  type: DecisionWindow['type'],
  opensAtMs: number,
): DecisionWindow {
  const choices = TEMPLATES[type]
  const tpl = choices[Math.floor(Math.random() * choices.length)]
  const options: DecisionOption[] = tpl.options.map((o) => ({
    id: randomUUID(),
    label: o.label,
    description: o.description,
    totalStreamed: 0,
    streamingRate: 0,
    lastUpdated: opensAtMs,
  }))
  return {
    id: randomUUID(),
    type,
    prompt: tpl.prompt,
    options,
    opensAt: opensAtMs,
    closesAt: opensAtMs + WINDOW_OPEN_DURATION_MS,
    isOpen: true,
  }
}
