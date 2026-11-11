import { useEffect, useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBusy(false)
      setError(null)
    }
  }, [open])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex gap-2.5">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn('btn flex-1', destructive ? 'bg-punch text-ink hover:brightness-110' : 'btn-primary')}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      {children}
      {error ? <p className="mt-3 text-sm font-semibold text-[#FF9DB6]">{error}</p> : null}
    </Sheet>
  )
}
