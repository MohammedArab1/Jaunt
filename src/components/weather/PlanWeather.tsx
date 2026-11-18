import { format, parseISO } from 'date-fns'
import { Droplets, Wind } from 'lucide-react'
import type { Activity, Trip } from '@/types'
import { useTripWeather } from '@/hooks/useTripWeather'
import { weatherModeLabel, weatherTempPrefix } from '@/lib/weather'
import {
  formatPrecip,
  formatTemp,
  formatWind,
  temperatureUnit,
  useWeatherUnits,
} from '@/lib/weatherUnits'
import { cn } from '@/lib/utils'
import { WeatherIcon, weatherMeta } from './weatherMeta'

export function PlanWeather({ activity, trip }: { activity: Activity; trip?: Trip }) {
  const { locations } = useTripWeather(trip)
  const [units] = useWeatherUnits()

  if (!trip || !activity.destinationId || locations.length === 0) return null

  const location = locations.find(
    (candidate) => candidate.destinationId === activity.destinationId,
  )
  const day = location?.days.find((candidate) => candidate.date === activity.date)
  if (!location || !day?.available) return null

  const meta = weatherMeta(day.weatherCode)
  const prefix = weatherTempPrefix(day.mode)
  const hour =
    activity.startTime && location.hourly.length
      ? location.hourly.find((entry) =>
          entry.time.startsWith(`${activity.date}T${activity.startTime?.slice(0, 2)}`),
        )
      : null

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] p-3.5">
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/[0.08] bg-fg/[0.04]',
        )}
      >
        <WeatherIcon
          code={day.weatherCode}
          isDay={hour?.isDay ?? true}
          className="h-5 w-5"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">
          {weatherModeLabel(day.mode)} · {location.name}
        </p>
        <p className="mt-0.5 text-sm font-extrabold text-fg">
          {meta.label} · {prefix}
          {formatTemp(day.tempMax, units)} / {prefix}
          {formatTemp(day.tempMin, units)}{' '}
          <span className="text-[10px] font-bold text-muted">{temperatureUnit(units)}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted">
          {day.precipProbability !== null ? (
            <span className="inline-flex items-center gap-1 text-sky">
              <Droplets className="h-3 w-3" />
              {day.mode === 'climate' ? '~' : ''}
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
        </p>
        {hour ? (
          <p className="mt-1 text-[10px] font-bold text-sky">
            At {format(parseISO(hour.time), 'h:mm a')}: {formatTemp(hour.temp, units)} ·{' '}
            {weatherMeta(hour.weatherCode, hour.isDay).label}
            {hour.precipProbability !== null ? ` · ${hour.precipProbability}% rain` : ''}
          </p>
        ) : null}
        {day.mode === 'climate' && day.rainYears != null && day.climateYears ? (
          <p className="mt-1 text-[9px] font-medium text-muted/60">
            Rain in {day.rainYears} of {day.climateYears} years.
          </p>
        ) : null}
      </div>
    </div>
  )
}
