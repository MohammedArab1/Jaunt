import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  full?: boolean
  wide?: boolean
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  full = false,
  wide = false,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'sheet-panel fixed z-50 flex flex-col border-white/10 bg-ink-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] outline-none',
            full
              ? 'inset-0 h-[100dvh] w-full sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px] sm:border'
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[32px] border-t sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px] sm:border',
            wide ? 'sm:w-[min(720px,94vw)]' : 'sm:w-[min(600px,94vw)]',
            className,
          )}
        >
          {!full && (
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden />
          )}

          <div
            className={cn(
              'flex shrink-0 items-start justify-between gap-4 px-5 pb-4 sm:px-7 sm:pt-6',
              full ? 'pt-[calc(env(safe-area-inset-top)+1.25rem)]' : 'pt-5',
            )}
          >
            <div className="min-w-0">
              <Dialog.Title className="break-words font-display text-2xl font-extrabold tracking-[-0.03em] text-cream sm:text-[28px]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm font-medium leading-relaxed text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button type="button" className="btn-icon -mr-1 mt-0.5" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-7">
            {children}
          </div>

          {footer ? (
            <div className="shrink-0 border-t border-white/[0.08] bg-ink-2/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur sm:px-7 sm:pb-5">
              {footer}
            </div>
          ) : (
            <div className="h-[calc(env(safe-area-inset-bottom)+0.5rem)] shrink-0 sm:h-2" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
