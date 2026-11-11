import { useEffect, useState } from 'react'

export type Theme = 'auto' | 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme')
      return saved === 'light' || saved === 'dark' ? saved : 'auto'
    } catch {
      return 'auto'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* armazenamento indisponível: segue sem lembrar a escolha */
    }
  }, [theme])

  return [theme, setTheme] as const
}
