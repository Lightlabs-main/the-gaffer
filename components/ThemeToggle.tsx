'use client'

import { useEffect, useSyncExternalStore } from 'react'

const THEME_KEY = 'gaffer-theme'
const THEME_EVENT = 'gaffer-theme-changed'

type Theme = 'light' | 'dark'

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Some embedded browsers disable localStorage; cookie fallback still works.
  }

  try {
    const cookieTheme = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${THEME_KEY}=`))
      ?.split('=')[1]
    if (cookieTheme === 'dark' || cookieTheme === 'light') return cookieTheme
  } catch {
    // Ignore and fall back to system preference.
  }

  if (window.name === `${THEME_KEY}:dark`) return 'dark'
  if (window.name === `${THEME_KEY}:light`) return 'light'

  return null
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = readStoredTheme()
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  window.queueMicrotask(callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => 'light')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Cookie below is the fallback.
    }
    try {
      document.cookie = `${THEME_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // The visual state still updates for this session.
    }
    window.name = `${THEME_KEY}:${next}`
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <button
      type="button"
      aria-pressed={theme === 'dark'}
      onClick={toggleTheme}
      suppressHydrationWarning
      className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-xl shadow-zinc-950/10 backdrop-blur transition active:scale-95"
    >
      <span
        suppressHydrationWarning
        className="grid size-5 place-items-center rounded-full bg-zinc-950 text-[10px] text-white"
      >
        {theme === 'dark' ? 'L' : 'D'}
      </span>
      <span suppressHydrationWarning>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
