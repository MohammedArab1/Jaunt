import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from '@/types'
import { api } from '@/lib/api'
import { clearAccountCache, ensureAccountProfile, hasAccountCache } from '@/lib/accountCache'

const GUEST_MODE_KEY = 'jaunt.guestMode'
const CACHED_USER_KEY = 'jaunt.cachedUser'

type AuthMode = 'account' | 'guest' | 'unset'

interface AuthContextValue {
  ready: boolean
  user: AuthUser | null
  mode: AuthMode
  offline: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateAccount: (displayName: string, color: string) => Promise<void>
  continueOffline: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readGuestMode(): boolean {
  try {
    return window.localStorage.getItem(GUEST_MODE_KEY) === '1'
  } catch {
    return false
  }
}

function setGuestMode(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(GUEST_MODE_KEY, '1')
    else window.localStorage.removeItem(GUEST_MODE_KEY)
  } catch {
    // Ignore private-mode storage failures.
  }
}

function readCachedUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.displayName === 'string' &&
      typeof parsed.color === 'string'
    ) {
      return parsed as AuthUser
    }
    return null
  } catch {
    return null
  }
}

function writeCachedUser(user: AuthUser | null): void {
  try {
    if (user) window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(CACHED_USER_KEY)
  } catch {
    // Ignore.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mode, setMode] = useState<AuthMode>('unset')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (mode === 'account') {
      void navigator.storage?.persist?.().catch(() => undefined)
    }
  }, [mode])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const cached = readCachedUser()

      try {
        const response = await api.auth.me()
        if (cancelled) return

        if (response.user) {
          await ensureAccountProfile(response.user)
          if (cancelled) return
          setUser(response.user)
          writeCachedUser(response.user)
          setGuestMode(false)
          setMode('account')
          setOffline(false)
        } else {
          writeCachedUser(null)
          setUser(null)
          setMode(readGuestMode() ? 'guest' : 'unset')
          setOffline(false)
        }
      } catch {
        if (cancelled) return

        if (cached && (await hasAccountCache(cached.id))) {
          setUser(cached)
          setMode('account')
          setOffline(true)
        } else {
          setUser(null)
          setMode(readGuestMode() ? 'guest' : 'unset')
          setOffline(true)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const applyUser = useCallback(async (nextUser: AuthUser) => {
    await ensureAccountProfile(nextUser)
    setUser(nextUser)
    writeCachedUser(nextUser)
    setGuestMode(false)
    setMode('account')
    setOffline(false)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.login(email, password)
      await applyUser(response.user)
    },
    [applyUser],
  )

  const register = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.register(email, password)
      await applyUser(response.user)
    },
    [applyUser],
  )

  const logout = useCallback(async () => {
    if (!user) return
    await api.auth.logout()
    await clearAccountCache(user.id)
    writeCachedUser(null)
    setUser(null)
    setMode('unset')
    setOffline(false)
  }, [user])

  const updateAccount = useCallback(
    async (displayName: string, color: string) => {
      const response = await api.auth.updateProfile(displayName, color)
      await ensureAccountProfile(response.user)
      setUser(response.user)
      writeCachedUser(response.user)
    },
    [],
  )

  const continueOffline = useCallback(() => {
    setGuestMode(true)
    setMode('guest')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ready, user, mode, offline, login, register, logout, updateAccount, continueOffline }),
    [ready, user, mode, offline, login, register, logout, updateAccount, continueOffline],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
