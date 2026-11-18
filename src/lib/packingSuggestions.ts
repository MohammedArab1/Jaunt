import type { PackingCategory, WeatherDay, WeatherLocation } from '@/types'

export interface PackingSuggestion {
  name: string
  category: PackingCategory
  reason: string
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86])

function isRainy(day: WeatherDay): boolean {
  return (
    (day.precipProbability ?? 0) >= 50 ||
    (day.precipSum ?? 0) >= 2 ||
    (day.weatherCode !== null && RAIN_CODES.has(day.weatherCode))
  )
}

function isSnowy(day: WeatherDay): boolean {
  return day.weatherCode !== null && SNOW_CODES.has(day.weatherCode)
}

export function buildPackingSuggestions(locations: WeatherLocation[]): PackingSuggestion[] {
  const days = locations.flatMap((location) => location.days).filter((day) => day.available)
  if (days.length === 0) return []

  const suggestions: PackingSuggestion[] = []
  const seen = new Set<string>()

  const add = (name: string, category: PackingCategory, reason: string) => {
    const key = name.trim().toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push({ name, category, reason })
  }

  if (days.some(isRainy)) {
    add('Umbrella', 'gear', 'Rain is likely during the trip')
    add('Waterproof jacket', 'clothing', 'Rain is likely during the trip')
  }

  if (days.some((day) => (day.tempMin ?? Infinity) <= 5)) {
    add('Warm layer', 'clothing', 'Cold temperatures expected')
    add('Gloves', 'clothing', 'Cold temperatures expected')
    add('Beanie', 'clothing', 'Cold temperatures expected')
  }

  if (days.some((day) => (day.tempMax ?? -Infinity) >= 30)) {
    add('Sun hat', 'clothing', 'Hot days expected')
    add('Reusable water bottle', 'gear', 'Hot days expected')
  }

  if (days.some((day) => (day.uvMax ?? 0) >= 6)) {
    add('Sunscreen', 'toiletries', 'High UV expected')
    add('Sunglasses', 'gear', 'High UV expected')
  }

  if (days.some((day) => (day.windMax ?? 0) >= 30)) {
    add('Windproof jacket', 'clothing', 'Windy days expected')
  }

  if (days.some(isSnowy)) {
    add('Snow boots', 'clothing', 'Snow expected')
    add('Thermal layers', 'clothing', 'Snow expected')
  }

  return suggestions.slice(0, 8)
}
