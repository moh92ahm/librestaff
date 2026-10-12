'use client'

import * as React from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type PwaInstallMode =
  | 'checking'
  | 'installed'
  | 'installable'
  | 'ios'
  | 'manual'
  | 'unavailable'

type PwaInstallContextValue = {
  mode: PwaInstallMode
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

const PwaInstallContext = React.createContext<PwaInstallContextValue | null>(null)

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<PwaInstallMode>('checking')
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (isStandalone()) {
      setMode('installed')
      return
    }

    setMode(isIos() ? 'ios' : 'manual')

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setMode('installable')
    }
    const handleInstalled = () => {
      setInstallPrompt(null)
      setMode('installed')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const promptInstall = React.useCallback(async () => {
    if (!installPrompt) return 'unavailable' as const

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      setMode('installed')
    }
    return choice.outcome
  }, [installPrompt])

  return (
    <PwaInstallContext.Provider value={{ mode, promptInstall }}>
      {children}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall() {
  const context = React.useContext(PwaInstallContext)
  if (!context) throw new Error('usePwaInstall must be used within PwaInstallProvider')
  return context
}
