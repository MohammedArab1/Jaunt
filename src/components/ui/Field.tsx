import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, hint, icon, children, className }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {icon}
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-punch">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs font-medium text-muted/70">{hint}</p>
      ) : null}
    </div>
  )
}
