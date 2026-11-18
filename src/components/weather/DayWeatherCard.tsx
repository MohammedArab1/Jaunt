import { Droplets, MapPin } from 'lucide-react'
import type { Activity, TripDestination, WeatherDay, WeatherLocation } from '@/types'
import {
  formatPrecip,
  formatTemp,
  type WeatherUnits,
} from '@/lib/weatherUnits'
import { weatherTempPrefix } from '@/lib/weather'
import { formatDay } from '@/lib/dates'
import { WeatherIcon } from './weatherMeta'

function rainLabel(day: WeatherDay, units: WeatherUnits): string | null {
  if (day.mode === 'forecast' && day.precipProbability !== null) {
    return `${day.precipProbability}%`
  }
  if (day.mode === 'climate' && day.precipProbability !== null) {
    return `~${day.precipProbability}%`
  }
  if (day.precipSum !== null && day.precipSum > 0) {
    return formatPrecip(day.precipSum, units)
  }
  return null
}

export function DayWeatherCard({
  locations,
  date,
  units,
  activities,
  destinations,
}: {
  locations: WeatherLocation[]
  date: string
  units: WeatherUnits
  activities: Activity[]
  destinations: TripDestination[]
}) {
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]))
  const orderedIds: string[] = []
  for (const activity of activities) {
    if (!activity.destinationId || !destinationById.has(activity.destinationId)) continue
    if (!orderedIds.includes(activity.destinationId)) orderedIds.push(activity.destinationId)
  }

  if (orderedIds.length === 0 && destinations.length === 1) {
    orderedIds.push(destinations[0].id)
  }

  const items = orderedIds.flatMap((destinationId) => {
    const location = locations.find((candidate) => candidate.destinationId === destinationId)
    const destination = destinationById.get(destinationId)
    if (!location || !destination) return []
    const day = location.days.find((candidate) => candidate.date === date)
    if (!day?.available) return []
    return [{ location, destination, day }]
  })

  if (items.length === 0) {
    if (destinations.length > 1 && activities.length > 0) {
      return (
        <div className="mb-2.5 flex items-center gap-2 rounded-2xl border border-dashed border-fg/10 px-3.5 py-2.5 text-[10px] font-medium text-muted/70">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          Add a location to this day&apos;s plans to see the weather.
        </div>
      )
    }
    return null
  }

  return (
    <div
      role="group"
      aria-label={`Weather for ${formatDay(date, 'EEEE, MMMM d')}`}
      className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-fg/[0.08] bg-fg/[0.025] px-3.5 py-2.5"
    >
      <span className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-muted/60">
        Weather
      </span>
      {items.map(({ location, day }) => {
        const prefix = weatherTempPrefix(day.mode)
        const rain = rainLabel(day, units)
        return (
          <span
            key={location.destinationId ?? location.name}
            className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-muted"
          >
            <WeatherIcon code={day.weatherCode} className="h-3.5 w-3.5" />
            <span className="truncate font-extrabold text-fg">{location.name}</span>
            <span className="whitespace-nowrap">
              {prefix}
              {formatTemp(day.tempMax, units)} / {prefix}
              {formatTemp(day.tempMin, units)}
            </span>
            {rain ? (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sky">
                <Droplets className="h-2.5 w-2.5" />
                {rain}
              </span>
            ) : null}
            {day.mode === 'climate' ? (
              <span className="text-[8px] uppercase tracking-[0.08em] text-violet">typical</span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
