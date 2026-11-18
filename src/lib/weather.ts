import { db } from '@/db'
import type { TripDestination, WeatherCacheRecord, WeatherLocation } from '@/types'
import { api } from './api'

export const WEATHER_STALE_MS = 3 * 60 * 60 * 1000

const inFlight = new Map<string, Promise<WeatherLocation>>()

export function weatherCacheKey(
  tripId: string,
  destination: TripDestination,
  start: string,
  end: string,
): string {
  return [
    tripId,
    destination.id,
    destination.name,
    destination.latitude?.toFixed(3) ?? '',
    destination.longitude?.toFixed(3) ?? '',
    destination.timezone ?? '',
    start,
    end,
  ].join(':')
}

export async function readWeatherCache(key: string): Promise<WeatherCacheRecord | undefined> {
  return db.weatherCache.get(key)
}

export async function writeWeatherCache(input: {
  key: string
  profileId: string
  tripId: string
  destinationId: string
  data: WeatherLocation
}): Promise<void> {
  await db.weatherCache.put({
    ...input,
    fetchedAt: Date.now(),
  })
}

export async function fetchWeatherLocation(
  destination: TripDestination,
  start: string,
  end: string,
): Promise<WeatherLocation> {
  const key = [
    destination.id,
    destination.name,
    destination.latitude?.toFixed(3) ?? '',
    destination.longitude?.toFixed(3) ?? '',
    destination.timezone ?? '',
    start,
    end,
  ].join(':')

  const existing = inFlight.get(key)
  if (existing) return existing

  const request = api
    .weather({
      name: destination.name,
      latitude: destination.latitude,
      longitude: destination.longitude,
      timezone: destination.timezone,
      start,
      end,
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, request)
  return request
}

export function weatherModeLabel(mode: 'forecast' | 'historical' | 'climate'): string {
  if (mode === 'climate') return 'Typical weather'
  if (mode === 'historical') return 'Recorded weather'
  return 'Forecast'
}

export function weatherTempPrefix(mode: 'forecast' | 'historical' | 'climate'): string {
  return mode === 'climate' ? '~' : ''
}
