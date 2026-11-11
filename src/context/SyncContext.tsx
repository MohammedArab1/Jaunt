import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { db } from '@/db'
import { useAuth } from './AuthContext'
import { subscribeLocalChanges } from '@/lib/syncBus'
import { runSync, SyncAbortedError, syncStateKey } from '@/lib/sync'
import { ApiError, isNetworkError } from '@/lib/api'
import { getErrorMessage } from '@/lib/utils'

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

interface SyncContextValue {
  status: SyncStatus
  error: string | null
  lastSyncedAt: number | null
  initialSync: boolean
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [initialSync, setInitialSync] = useState(false)
  const inFlight = useRef(false)
  const queued = useRef(false)

  const syncNow = useCallback(async () => {
    if (mode !== 'account' || !user) return

    if (inFlight.current) {
      queued.current = true
      return
    }

    inFlight.current = true
    setStatus('syncing')
    setError(null)

    try {
      const result = await runSync(user.id)
      setLastSyncedAt(result.lastSyncedAt)
      setInitialSync(false)
      setStatus('idle')
    } catch (cause) {
      if (cause instanceof SyncAbortedError) {
        setStatus('idle')
        return
      }

      if (cause instanceof ApiError && cause.status === 401) {
        setStatus('error')
        setError('Your session expired. Sign out and sign back in to resume sync.')
      } else if (isNetworkError(cause)) {
        setStatus('offline')
        setError('Offline — changes are waiting on this device.')
      } else {
        setStatus('error')
        setError(getErrorMessage(cause))
      }
      setInitialSync(false)
    } finally {
      inFlight.current = false
      if (queued.current) {
        queued.current = false
        window.setTimeout(() => {
          void syncNow()
        }, 350)
      }
    }
  }, [mode, user])

  useEffect(() => {
    if (mode !== 'account' || !user) {
      setStatus('idle')
      setError(null)
      setLastSyncedAt(null)
      setInitialSync(false)
      return
    }

    let disposed = false
    let debounceTimer: number | undefined
    let disposedAt = 0

    setError(null)
    setStatus('idle')

    void db.syncMeta.get(syncStateKey(user.id)).then((state) => {
      if (disposed) return
      setLastSyncedAt(state?.lastSyncedAt ?? null)
      setInitialSync(!state)
    })

    const schedule = (delay = 1200) => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        if (!disposed) void syncNow()
      }, delay)
    }

    const unsubscribe = subscribeLocalChanges(() => schedule())
    const handleOnline = () => schedule(100)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - disposedAt > 15_000) {
        disposedAt = Date.now()
        schedule(100)
      }
    }

    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, 60_000)

    disposedAt = Date.now()
    void syncNow()

    return () => {
      disposed = true
      window.clearTimeout(debounceTimer)
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
    }
  }, [mode, user, syncNow])

  const value = useMemo<SyncContextValue>(
    () => ({ status, error, lastSyncedAt, initialSync, syncNow }),
    [status, error, lastSyncedAt, initialSync, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync must be used within SyncProvider')
  return context
}
