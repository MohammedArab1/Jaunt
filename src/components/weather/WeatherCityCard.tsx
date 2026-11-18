import { ChevronRight, Droplets } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import type { WeatherDay, WeatherLocation, WeatherMode } from '@/types'
import { cn } from '@/lib/utils'
import {
  formatTemp,
  temperatureUnit,
  type WeatherUnits,
} from '@/lib/weatherUnits'
import { WeatherIcon, weatherMeta } from './weatherMeta'

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function dominantCode(days: WeatherDay[]): number | null {
  const counts = new Map<number, number>()
  for (const day of days) {
    if (day.weatherCode === null) continue
    counts.set(day.weatherCode, (counts.get(day.weatherCode) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code
      bestCount = count
    }
  }
  return best
}

function modeSummary(days: WeatherDay[]): { label: string; prefix: string } {
  if (days.length === 0) return { label: 'No data', prefix: '' }
  const modes = new Set<WeatherMode>(days.map((day) => day.mode))
  if (modes.size !== 1) return { label: 'Trip average', prefix: '' }
  const mode = [...modes][0]
  if (mode === 'climate') return { label: '5-year average', prefix: '~' }
  if (mode === 'historical') return { label: 'Recorded average', prefix: '' }
  return { label: 'Forecast average', prefix: '' }
}

function rainSummary(days: WeatherDay[]): string {
  if (days.length === 0) return 'No weather data'
  const rainy = days.filter((day) => {
    if (day.mode === 'forecast' || day.mode === 'climate') {
      return (day.precipProbability ?? 0) >= 40 || (day.precipSum ?? 0) >= 1
    }
    return (day.precipSum ?? 0) >= 1
  }).length

  if (rainy === 0) return 'Mostly dry'
  return `Rain likely on ${rainy} of ${days.length} days`
}

interface WeatherCityCardProps {
  location: WeatherLocation
  units: WeatherUnits
  onOpen: () => void
}

export function WeatherCityCard({ location, units, onOpen }: WeatherCityCardProps) {
  const days = location.days.filter((day) => day.available)
  const meta = weatherMeta(dominantCode(days))
  const summary = modeSummary(days)
  const currentMeta = location.current
    ? weatherMeta(location.current.weatherCode, location.current.isDay)
    : null
  const avgHigh = average(days.map((day) => day.tempMax))
  const avgLow = average(days.map((day) => day.tempMin))
  const unitLabel = temperatureUnit(units)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open weather details for ${location.name}`}
      className="surface group w-full p-4 text-left transition hover:bg-fg/[0.055]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-extrabold tracking-[-0.03em] text-fg">
            {location.name}
          </h3>
          <p className="mt-0.5 truncate text-[10px] font-bold text-muted">
            {[location.admin1, location.country].filter(Boolean).join(', ') || 'Destination'}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-muted">
            <WeatherIcon code={dominantCode(days)} className="h-3.5 w-3.5" />
            {meta.label}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-extrabold leading-none tracking-[-0.04em] text-fg">
            {avgHigh !== null ? `${summary.prefix}${formatTemp(avgHigh, units)}` : '—'}
            <span className="text-base font-bold text-muted">
              {' '}
              / {avgLow !== null ? `${summary.prefix}${formatTemp(avgLow, units)}` : '—'}
            </span>
          </p>
          <p className="mt-1 text-[9px] font-bold text-muted">
            {summary.label} · {unitLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted">
        <span className="inline-flex items-center gap-1">
          <Droplets className={cn('h-3 w-3', rainSummary(days) === 'Mostly dry' ? 'text-muted' : 'text-sky')} />
          {rainSummary(days)}
        </span>
        {location.current && currentMeta ? (
          <span className="inline-flex items-center gap-1 text-sky">
            Now {formatTemp(location.current.temp, units)} · {currentMeta.label}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[9px] font-bold text-muted/50">
        <span>Updated {formatDistanceToNowStrict(location.fetchedAt, { addSuffix: true })}</span>
        <span className="inline-flex items-center gap-1 text-muted transition group-hover:text-fg">
          Day by day
          <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  )
}
