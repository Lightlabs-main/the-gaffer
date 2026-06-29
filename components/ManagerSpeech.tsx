'use client'

import { useEffect, useState } from 'react'

interface Props {
  speech: string | null
  speechKey: string | null
}

export default function ManagerSpeech({ speech, speechKey }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (speech && speechKey) {
      const showTimer = window.setTimeout(() => setVisible(true), 0)
      const hideTimer = window.setTimeout(() => setVisible(false), 8000)
      return () => {
        window.clearTimeout(showTimer)
        window.clearTimeout(hideTimer)
      }
    }
  }, [speech, speechKey])

  if (!speech || !visible) return null

  return (
    <div
      className="live-card w-full p-4"
      style={{ animation: 'fade-out 8s ease-in-out forwards' }}
      key={speechKey}
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
        The Gaffer speaks
      </div>
      <p className="text-sm italic leading-relaxed text-zinc-200">
        &ldquo;{speech}&rdquo;
      </p>
    </div>
  )
}
