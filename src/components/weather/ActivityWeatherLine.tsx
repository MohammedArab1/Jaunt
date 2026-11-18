import { Droplets } from 'lucide-react'
import type { Activity, Trip } from '@/types'
import { useTripWeather } from '@/hooks/useTripWeather'
import { formatTemp, useWeatherUnits } from '@/lib/weatherUnits'
import { weatherTempPrefix } from '@/lib/weather'
import { WeatherIcon, weatherMeta } from './weatherMeta'

export function ActivityWeatherLine({
  activity,
  trip,
}: {
  activity: Activity
  trip: Trip
}) {
  const { locations } = useTripWeather(trip)
  const [units] = useWeatherUnits()

  if (!activity.destinationId) return null
  const location = locations.find(
    (candidate) => candidate.destinationId === activity.destinationId,
  )
  const day = location?.days.find((candidate) => candidate.date === activity.date)
  if (!location || !day?.available) return null

  const prefix = weatherTempPrefix(day.mode)
  const meta = weatherMeta(day.weatherCode)
  const rain =
    day.mode === 'forecast' && day.precipProbability !== null
      ? `${day.precipProbability}%`
      : day.mode === 'climate' && day.precipProbability !== null
        ? `~${day.precipProbability}%`
        : null

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-muted">
      <WeatherIcon code={day.weatherCode} className="h-3 w-3" />
      <span className="font-extrabold text-fg">{location.name}</span>
      <span className="whitespace-nowrap">
        {prefix}
        {formatTemp(day.tempMax, units)} / {prefix}
        {formatTemp(day.tempMin, units)}
      </span>
      <span>{meta.label}</span>
      {rain ? (
        <span className="inline-flex items-center gap-0.5 text-sky">
          <Droplets className="h-2.5 w-2.5" />
          {rain}
        </span>
      ) : null}
      {day.mode === 'climate' ? (
        <span className="text-[8px] uppercase tracking-[0.08em] text-violet">typical</span>
      ) : null}
    </span>
  )
}
