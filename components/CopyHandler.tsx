'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __gafferCopyHandler?: boolean
  }
}

function fallbackCopy(text: string) {
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export default function CopyHandler() {
  useEffect(() => {
    if (window.__gafferCopyHandler) return
    window.__gafferCopyHandler = true

    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null
      const button = target?.closest<HTMLElement>('[data-copy-text]')
      const text = button?.dataset.copyText
      if (!button || !text) return

      event.preventDefault()
      const original = button.dataset.copyDefault || button.textContent || 'Copy'
      const success = button.dataset.copySuccess || 'Copied'
      const fail = button.dataset.copyFail || 'Copy failed'

      const copyPromise = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(text)
        : Promise.resolve(fallbackCopy(text))

      copyPromise
        .then(() => {
          button.textContent = success
        })
        .catch(() => {
          try {
            fallbackCopy(text)
            button.textContent = success
          } catch {
            button.textContent = fail
          }
        })
        .finally(() => {
          window.setTimeout(() => {
            button.textContent = original
          }, 1800)
        })
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
