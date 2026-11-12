import { CalendarDays } from 'lucide-react'
import { formatDay } from '@/lib/dates'
import { cn } from '@/lib/utils'

interface DateInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  className?: string
  placeholder?: string
}

/**
 * A native date input with a controlled visual layer.
 *
 * iOS Safari renders the native date value without honouring the input's
 * horizontal padding, which makes a leading icon overlap the value. Keeping
 * the native input transparent on top of a styled display avoids that entirely
 * while preserving the platform date picker.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  required,
  className,
  placeholder = 'Pick a date',
}: DateInputProps) {
  return (
    <div
      className={cn(
        'field relative flex items-center pl-10 focus-within:border-coral/50 focus-within:bg-fg/[0.06]',
        className,
      )}
    >
      <CalendarDays
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <span
        className={cn('min-w-0 truncate', value ? 'text-fg' : 'text-muted/45')}
        aria-hidden="true"
      >
        {value ? formatDay(value, 'MMM d, yyyy') : placeholder}
      </span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl text-base opacity-0 focus-visible:outline-none"
      />
    </div>
  )
}
