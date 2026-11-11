import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isIos, isStandalone } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface InstallContextValue {
  canInstall: boolean
  installed: boolean
  ios: boolean
  install: () => Promise<boolean>
}

const InstallContext = createContext<InstallContextValue | null>(null)

export function InstallProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
    return choice.outcome === 'accepted'
  }, [promptEvent])

  const value = useMemo<InstallContextValue>(
    () => ({ canInstall: Boolean(promptEvent), installed, ios: isIos(), install }),
    [promptEvent, installed, install],
  )

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>
}

export function useInstall(): InstallContextValue {
  const context = useContext(InstallContext)
  if (!context) throw new Error('useInstall must be used within InstallProvider')
  return context
}
