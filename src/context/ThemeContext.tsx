import { createContext, useContext, ReactNode, useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

type ThemeContextType = {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_KEY = 'pingget_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    // Force commerce light look (Dunzo/Blinkit style). Ignore stale dark preference.
    return 'light'
  })

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    const root = document.documentElement
    root.classList.add('light-mode')
    root.classList.remove('dark-mode')
  }, [theme])

  const toggle = () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
