'use client'

import * as React from 'react'
import type { AppTheme } from '@/lib/theme'

type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
}: {
  children: React.ReactNode
  defaultTheme?: AppTheme
}) {
  const [theme, setThemeState] = React.useState<AppTheme>(defaultTheme)

  const setTheme = React.useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(nextTheme)
  }, [])

  React.useEffect(() => {
    setTheme(defaultTheme)
  }, [defaultTheme, setTheme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'light' as AppTheme,
      setTheme: () => {},
    }
  }

  return context
}
