import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  default: 'border-white/10 bg-surface-2 text-cream',
  success: 'border-mint/30 bg-[#13251D] text-mint',
  error: 'border-punch/30 bg-[#2A1420] text-[#FFB3C5]',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'default', duration = 3600) => {
      counter.current += 1
      const id = counter.current
      setToasts((current) => [...current.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'animate-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl shadow-black/40 backdrop-blur-xl',
              toneStyles[item.tone],
            )}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : item.tone === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 text-coral" />
            )}
            <span className="flex-1">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-full p-1 text-current/60 transition hover:bg-black/10 hover:text-current"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
