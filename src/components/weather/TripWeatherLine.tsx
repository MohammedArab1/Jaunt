import type { Trip } from '@/types'
import { useTripWeather } from '@/hooks/useTripWeather'
import { formatTemp, useWeatherUnits } from '@/lib/weatherUnits'
import { WeatherIcon } from './weatherMeta'

export function TripWeatherLine({ trip }: { trip: Trip }) {
  const { locations } = useTripWeather(trip)
  const [units] = useWeatherUnits()

  const items = locations
    .map((location) => {
      const current = location.current
      const today = location.days[0]
      const temp = current?.temp ?? today?.tempMax ?? null
      const code = current?.weatherCode ?? today?.weatherCode ?? null
      if (temp === null || code === null) return null
      return {
        id: location.destinationId ?? location.name,
        name: location.name,
        temp,
        code,
        isDay: current?.isDay ?? true,
      }
    })
    .filter(
      (
        item,
      ): item is {
        id: string
        name: string
        temp: number
        code: number
        isDay: boolean
      } => item !== null,
    )

  if (items.length === 0) return null

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted/80">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1">
          <WeatherIcon code={item.code} isDay={item.isDay} className="h-3 w-3" />
          {item.name} {formatTemp(item.temp, units)}
        </span>
      ))}
    </span>
  )
}
