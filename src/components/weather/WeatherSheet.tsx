import { format, parseISO } from 'date-fns'
import { Droplets, ExternalLink, Sun, Wind } from 'lucide-react'
import type { WeatherDay, WeatherLocation } from '@/types'
import { formatDay } from '@/lib/dates'
import { cn, hexAlpha } from '@/lib/utils'
import {
  formatPrecip,
  formatTemp,
  formatUv,
  formatWind,
  temperatureUnit,
  type WeatherUnits,
} from '@/lib/weatherUnits'
import { weatherModeLabel } from '@/lib/weather'
import { Sheet } from '@/components/ui/Sheet'
import { WeatherIcon, weatherMeta } from './weatherMeta'
import { WeatherUnitsToggle } from './WeatherUnitsToggle'

function timeLabel(value: string | null): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'h:mm a')
  } catch {
    return '—'
  }
}

function DailyWeatherRow({ day, units }: { day: WeatherDay; units: WeatherUnits }) {
  const meta = weatherMeta(day.weatherCode)
  const climate = day.mode === 'climate'
  const historical = day.mode === 'historical'
  const prefix = climate ? '~' : ''

  if (!day.available) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-fg/10 px-3.5 py-3">
        <div>
          <p className="text-xs font-extrabold text-fg">{formatDay(day.date, 'EEE, MMM d')}</p>
          <p className="mt-0.5 text-[10px] font-bold text-muted">{weatherModeLabel(day.mode)}</p>
        </div>
        <p className="text-xs font-bold text-muted">No data</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.025] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold text-fg">{formatDay(day.date, 'EEE, MMM d')}</p>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em]',
                climate
                  ? 'bg-violet/10 text-violet'
                  : historical
                    ? 'bg-sun/10 text-sun'
                    : 'bg-sky/10 text-sky',
              )}
            >
              {climate ? 'Typical' : historical ? 'Recorded' : 'Forecast'}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-muted">
            <WeatherIcon code={day.weatherCode} className="h-3.5 w-3.5" />
            {meta.label}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-fg">
            {prefix}
            {formatTemp(day.tempMax, units)} / {prefix}
            {formatTemp(day.tempMin, units)}
          </p>
          <p className="text-[9px] font-bold text-muted">{temperatureUnit(units)}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted">
        {day.precipProbability !== null ? (
          <span className="inline-flex items-center gap-1 text-sky">
            <Droplets className="h-3 w-3" />
            {climate ? '~' : ''}
            {day.precipProbability}% rain
          </span>
        ) : day.precipSum !== null && day.precipSum > 0 ? (
          <span className="inline-flex items-center gap-1 text-sky">
            <Droplets className="h-3 w-3" />
            {formatPrecip(day.precipSum, units)}
          </span>
        ) : null}
        {day.windMax !== null ? (
          <span className="inline-flex items-center gap-1">
            <Wind className="h-3 w-3" />
            {formatWind(day.windMax, units)}
          </span>
        ) : null}
        {day.uvMax !== null ? (
          <span className="inline-flex items-center gap-1">
            <Sun className="h-3 w-3 text-sun" />
            UV {formatUv(day.uvMax)}
          </span>
        ) : null}
        {day.sunrise ? <span>Sunrise {timeLabel(day.sunrise)}</span> : null}
        {day.sunset ? <span>Sunset {timeLabel(day.sunset)}</span> : null}
      </div>

      {climate && day.rainYears != null && day.climateYears ? (
        <p className="mt-2 text-[9px] font-medium text-muted/60">
          Rain in {day.rainYears} of {day.climateYears} years.
        </p>
      ) : null}
    </div>
  )
}

interface WeatherSheetProps {
  location: WeatherLocation
  units: WeatherUnits
  onClose: () => void
}

export function WeatherSheet({ location, units, onClose }: WeatherSheetProps) {
  const currentMeta = location.current
    ? weatherMeta(location.current.weatherCode, location.current.isDay)
    : null
  const first = location.days[0]?.date
  const last = location.days[location.days.length - 1]?.date
  const range = first && last ? `${formatDay(first, 'MMM d')} – ${formatDay(last, 'MMM d')}` : ''

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Weather in ${location.name}`}
      description={[range, location.timezone].filter(Boolean).join(' · ')}
      footer={
        <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-5 pb-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold text-muted">
            Updated{' '}
            {formatDistanceToNowSafe(location.fetchedAt)}
          </p>
          <WeatherUnitsToggle />
        </div>

        {location.current && currentMeta ? (
          <div
            className="relative overflow-hidden rounded-[24px] border p-4"
            style={{
              borderColor: hexAlpha('#5ec8ff', 0.22),
              background: 'linear-gradient(135deg, rgba(94,200,255,0.12), var(--color-sheen) 70%)',
            }}
          >
            <div className="relative flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-sky/20 bg-sky/10">
                <WeatherIcon
                  code={location.current.weatherCode}
                  isDay={location.current.isDay}
                  className="h-7 w-7"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Right now</p>
                <p className="font-display text-3xl font-extrabold tracking-[-0.04em] text-fg">
                  {formatTemp(location.current.temp, units)}
                  <span className="ml-1 text-sm font-bold text-muted">
                    {temperatureUnit(units)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-muted">
                  {currentMeta.label}
                  {location.current.feelsLike !== null
                    ? ` · Feels like ${formatTemp(location.current.feelsLike, units)}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {location.hourly.length > 0 ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">
                {location.current ? 'Next few hours' : 'Hourly forecast'}
              </p>
              <span className="text-[9px] font-bold text-muted/50">Forecast</span>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {location.hourly.map((hour) => {
                return (
                  <div
                    key={hour.time}
                    className="min-w-[66px] shrink-0 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-2 py-2.5 text-center"
                  >
                    <p className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-muted">
                      {format(parseISO(hour.time), 'EEE')}
                    </p>
                    <p className="text-[9px] font-bold text-muted/60">
                      {format(parseISO(hour.time), 'h a')}
                    </p>
                    <WeatherIcon
                      code={hour.weatherCode}
                      isDay={hour.isDay}
                      className="mx-auto mt-1.5 h-4 w-4"
                    />
                    <p className="mt-1 text-[11px] font-extrabold text-fg">
                      {formatTemp(hour.temp, units)}
                    </p>
                    {hour.precipProbability !== null ? (
                      <p className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-bold text-sky">
                        <Droplets className="h-2.5 w-2.5" />
                        {hour.precipProbability}%
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Day by day</p>
            <span className="text-[9px] font-bold text-muted/50">{location.days.length} days</span>
          </div>
          <div className="space-y-2">
            {location.days.map((day) => (
              <DailyWeatherRow key={day.date} day={day} units={units} />
            ))}
          </div>
        </section>

        <a
          href={location.attribution.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted transition hover:text-fg"
        >
          Weather data by {location.attribution.name}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Sheet>
  )
}

function formatDistanceToNowSafe(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}
