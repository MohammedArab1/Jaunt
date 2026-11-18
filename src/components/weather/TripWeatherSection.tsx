import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type { Trip, WeatherLocation } from '@/types'
import { tripDestinations } from '@/lib/tripDestinations'
import { useWeatherUnits } from '@/lib/weatherUnits'
import { WeatherCityCard } from './WeatherCityCard'
import { WeatherSheet } from './WeatherSheet'
import { WeatherUnitsToggle } from './WeatherUnitsToggle'

interface TripWeatherSectionProps {
  trip: Trip
  locations: WeatherLocation[]
  errors: Record<string, string>
  loading: boolean
  refresh: () => void
}

export function TripWeatherSection({
  trip,
  locations,
  errors,
  loading,
  refresh,
}: TripWeatherSectionProps) {
  const destinations = tripDestinations(trip)
  const [units] = useWeatherUnits()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (destinations.length === 0) return null

  const selected =
    locations.find((location) => (location.destinationId ?? location.name) === selectedId) ?? null
  const failedDestinations = destinations.filter((destination) => errors[destination.id])
  const initialLoading = loading && locations.length === 0

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Weather</p>
          <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-fg">
            What it&apos;s looking like
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <WeatherUnitsToggle />
          <button
            type="button"
            onClick={refresh}
            className="btn-icon-sm h-8 w-8"
            aria-label="Refresh weather"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {initialLoading ? (
        <div className="surface flex items-center gap-3 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-coral" />
          <p className="text-xs font-bold text-muted">Checking the weather…</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="surface flex items-center justify-between gap-3 p-4">
          <p className="text-xs font-medium leading-relaxed text-muted">
            {failedDestinations[0] ? errors[failedDestinations[0].id] : 'Weather is unavailable right now.'}
          </p>
          <button type="button" className="btn btn-secondary h-9 px-3 text-[10px]" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : (
        <div className={`grid gap-3 ${locations.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {locations.map((location) => (
            <WeatherCityCard
              key={location.destinationId ?? location.name}
              location={location}
              units={units}
              onOpen={() => setSelectedId(location.destinationId ?? location.name)}
            />
          ))}
        </div>
      )}

      {locations.length > 0 ? (
        <p className="mt-2 text-[9px] font-medium text-muted/50">
          Weather data by{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-white/15 underline-offset-2 transition hover:text-fg"
          >
            Open-Meteo
          </a>
        </p>
      ) : null}

      {failedDestinations.length > 0 && locations.length > 0 ? (
        <p className="mt-1 text-[10px] font-medium text-muted/60">
          Could not load weather for{' '}
          {failedDestinations.map((destination) => destination.name).join(', ')}.
        </p>
      ) : null}

      {selected ? (
        <WeatherSheet
          location={selected}
          units={units}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </section>
  )
}
