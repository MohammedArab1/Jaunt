import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TimeInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * A native time input.
 *
 * Like DateInput, it stays uncontrolled while the user is interacting with the
 * native picker so WebKit does not reset the time segments on every keystroke.
 */
export function TimeInput({ id, value, onChange, className }: TimeInputProps) {
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
      type="time"
      defaultValue={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn('field min-w-0', className)}
    />
  )
}
