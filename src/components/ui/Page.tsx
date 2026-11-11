import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'page-enter relative z-10 mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+7.75rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:px-10 lg:pb-16 lg:pt-12',
        className,
      )}
    >
      {children}
    </div>
  )
}
