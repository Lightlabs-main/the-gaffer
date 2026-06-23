'use client'

import { useEffect, useState } from 'react'

interface Props {
  speech: string | null
  speechKey: string | null
}

export default function ManagerSpeech({ speech, speechKey }: Props) {
  const [visible, setVisible] = useState(false)
  const [displayedSpeech, setDisplayedSpeech] = useState<string | null>(null)

  useEffect(() => {
    if (speech && speechKey) {
      setDisplayedSpeech(speech)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [speech, speechKey])

  if (!displayedSpeech || !visible) return null

  return (
    <div
      className="w-full rounded-lg border border-[var(--pitch-dim)]/20 bg-[var(--pitch-green)]/5 p-4"
      style={{ animation: 'fade-out 8s ease-in-out forwards' }}
      key={speechKey}
    >
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--pitch-dim)]">
        The Gaffer speaks
      </div>
      <p className="text-sm italic leading-relaxed text-zinc-200">
        &ldquo;{displayedSpeech}&rdquo;
      </p>
    </div>
  )
}
