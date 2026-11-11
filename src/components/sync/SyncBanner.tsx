import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'

export function SyncBanner() {
  const { mode } = useAuth()
  const { status, error, initialSync, syncNow } = useSync()

  if (mode !== 'account') return null
  if (status === 'idle') return null
  if (status === 'syncing' && !initialSync) return null

  const syncing = status === 'syncing'
  const offline = status === 'offline'

  return (
    <div className="sticky top-0 z-30 border-b border-fg/[0.08] bg-surface/95 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.6rem)] backdrop-blur-xl sm:px-6 lg:pl-10">
      <div className="mx-auto flex max-w-3xl items-center gap-2.5">
        {syncing ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-sky" />
        ) : offline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-sun" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-punch" />
        )}
        <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-muted">
          {syncing
            ? 'Bringing your plans onto this device…'
            : offline
              ? 'Offline — changes are saved here and will sync when you reconnect.'
              : (error ?? 'Sync is having trouble.')}
        </p>
        {!syncing ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            className="shrink-0 rounded-full border border-fg/10 bg-fg/[0.05] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-fg transition hover:bg-fg/[0.1]"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
