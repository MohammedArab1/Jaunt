import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-dashed border-fg/15 bg-fg/[0.025] px-6 py-10 text-center',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-coral/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-violet/10 blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-fg/10 bg-fg/[0.05] text-coral">
          {icon}
        </div>
        <h3 className="font-display text-xl font-extrabold tracking-[-0.02em] text-fg">{title}</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-relaxed text-muted">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}
