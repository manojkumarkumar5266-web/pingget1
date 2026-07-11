import { createContext, useContext, ReactNode } from 'react'

type Theme = 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
