import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2, MapPin, Plus, X } from 'lucide-react'
import type { CityOption, TripDestination } from '@/types'
import { api, isNetworkError } from '@/lib/api'
import { newId } from '@/lib/id'
import { cn } from '@/lib/utils'

interface DestinationComboboxProps {
  id: string
  value: TripDestination[]
  onChange: (value: TripDestination[]) => void
}

const MAX_CITIES = 10

function destinationFromOption(option: CityOption): TripDestination {
  return {
    id: option.id,
    name: option.name,
    country: option.country,
    admin1: option.admin1,
    latitude: option.latitude,
    longitude: option.longitude,
    timezone: option.timezone,
  }
}

function optionDetail(option: CityOption): string {
  return [
    option.admin1 && option.admin1 !== option.name ? option.admin1 : null,
    option.country,
  ]
    .filter(Boolean)
    .join(', ')
}

export function DestinationCombobox({ id, value, onChange }: DestinationComboboxProps) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CityOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setOptions([])
      setOpen(false)
      setLoading(false)
      setError(null)
      setActiveIndex(-1)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setOpen(false)
    setActiveIndex(-1)

    const timer = window.setTimeout(async () => {
      try {
        const response = await api.geocode(trimmed)
        if (cancelled) return
        setOptions(response.results)
        setOpen(true)
      } catch (cause) {
        if (cancelled) return
        setOptions([])
        setOpen(true)
        setError(
          isNetworkError(cause)
            ? 'No suggestions right now — press Enter to add what you typed.'
            : 'No city suggestions found — press Enter to add what you typed.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const resetSearch = () => {
    setQuery('')
    setOptions([])
    setError(null)
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const addCity = (raw: string) => {
    const city = raw.trim().replace(/\s+/g, ' ')
    if (!city) return

    if (value.some((existing) => existing.name.toLowerCase() === city.toLowerCase())) {
      resetSearch()
      return
    }

    if (value.length >= MAX_CITIES) {
      setError(`You can add up to ${MAX_CITIES} cities.`)
      return
    }

    onChange([...value, { id: newId(), name: city }])
    resetSearch()
  }

  const addSuggestion = (option: CityOption) => {
    if (value.some((existing) => existing.id === option.id)) {
      resetSearch()
      return
    }

    if (value.length >= MAX_CITIES) {
      setError(`You can add up to ${MAX_CITIES} cities.`)
      return
    }

    onChange([...value, destinationFromOption(option)])
    resetSearch()
  }

  const removeCity = (id: string) => {
    onChange(value.filter((item) => item.id !== id))
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (options.length > 0) {
        setActiveIndex((index) => Math.min(options.length - 1, index + 1))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(-1, index - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && activeIndex >= 0 && options[activeIndex]) {
        addSuggestion(options[activeIndex])
      } else {
        addCity(query)
      }
      return
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key === 'Backspace' && !query && value.length > 0) {
      event.preventDefault()
      removeCity(value[value.length - 1].id)
    }
  }

  return (
    <div ref={containerRef}>
      <div className="field relative flex min-h-12 flex-wrap items-center gap-1.5 py-2 pl-10 pr-3 focus-within:border-coral/50 focus-within:bg-fg/[0.06]">
        <MapPin className="pointer-events-none absolute left-3.5 top-5 h-4 w-4 text-muted" />

        {value.map((city) => (
          <span
            key={city.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-coral/10 px-2.5 py-1 text-[10px] font-extrabold text-coral"
          >
            <span className="truncate" title={city.country ? `${city.name}, ${city.country}` : city.name}>
              {city.name}
            </span>
            <button
              type="button"
              onClick={() => removeCity(city.id)}
              aria-label={`Remove ${city.name}`}
              className="shrink-0 rounded-full p-0.5 transition hover:bg-coral/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          id={id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (options.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          placeholder={value.length ? 'Add another city…' : 'Type a city…'}
          className="min-w-[7rem] flex-1 bg-transparent py-1 text-[15px] font-semibold text-fg outline-none placeholder:text-muted/45"
          autoComplete="off"
          spellCheck={false}
          maxLength={80}
        />

        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" /> : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div
          id={`${id}-options`}
          role="listbox"
          className="mt-1 max-h-64 overflow-y-auto rounded-2xl border border-fg/10 bg-ink-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
        >
          {options.map((option, index) => (
            <button
              key={`${option.id}-${option.name}`}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addSuggestion(option)}
              className={cn(
                'flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition',
                index === activeIndex ? 'bg-coral/10' : 'hover:bg-fg/[0.04]',
              )}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-fg">{option.name}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold text-muted">
                  {optionDetail(option) || 'City'}
                </span>
              </span>
              <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            </button>
          ))}

          {options.length === 0 && !error ? (
            <p className="px-3.5 py-3 text-xs font-medium text-muted">No city suggestions found.</p>
          ) : null}

          {error ? (
            <p className="px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-muted">{error}</p>
          ) : null}

          <p className="border-t border-fg/[0.06] px-3.5 py-2 text-[10px] font-medium leading-relaxed text-muted/60">
            Press Enter to add “{query.trim() || 'a city'}” even if it isn’t listed.
          </p>
        </div>
      ) : null}

      {error && !open ? (
        <p className="mt-1.5 text-[11px] font-semibold text-punch">{error}</p>
      ) : null}
    </div>
  )
}
