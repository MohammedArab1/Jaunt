import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-fg/15 bg-surface-2/95 p-3 pl-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <RefreshCw className="h-4 w-4 shrink-0 text-coral" />
      <p className="flex-1 text-sm font-bold text-fg">A fresh version of Jaunt is ready.</p>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="rounded-full bg-coral px-3.5 py-2 text-xs font-extrabold text-ink"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="rounded-full p-1.5 text-muted hover:text-fg"
        aria-label="Dismiss update"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
