import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'studio-dima-theme'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Tailwind dark mode
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  // CoreUI / Bootstrap dark mode (per componenti non ancora migrati)
  root.setAttribute('data-bs-theme', theme)
  root.setAttribute('data-coreui-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
