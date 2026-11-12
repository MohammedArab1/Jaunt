import type { ReactNode } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: ReactNode
  description?: string
  actions?: ReactNode
  onBack?: () => void
  backLabel?: string
  className?: string
  showSearch?: boolean
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  onBack,
  backLabel = 'Back',
  className,
  showSearch = true,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6', className)}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-extrabold text-muted transition hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
          <h1 className="break-words text-balance font-display text-[2.55rem] font-extrabold leading-[0.94] tracking-[-0.045em] text-fg sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-md break-words text-sm font-medium leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {showSearch ? (
            <Link
              to="/search"
              aria-label="Search everything"
              className="btn-icon h-10 w-10"
            >
              <Search className="h-4 w-4" />
            </Link>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  )
}
