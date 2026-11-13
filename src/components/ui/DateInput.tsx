import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  className?: string
}

/**
 * A native date input.
 *
 * The input is deliberately uncontrolled while the user is editing it. React
 * still receives every change, but WebKit is not forced to reset the native
 * date segments on each keystroke. External value changes are synced through
 * the ref when the field is not focused.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  required,
  className,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = inputRef.current
    if (input && document.activeElement !== input && input.value !== value) {
      input.value = value
    }
  }, [value])

  return (
    <input
      ref={inputRef}
      id={id}
      type="date"
      defaultValue={value}
      min={min}
      max={max}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className={cn('field', className)}
    />
  )
}
