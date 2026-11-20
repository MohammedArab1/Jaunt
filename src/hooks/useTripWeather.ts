import { useEffect, useMemo, useRef, useState } from 'react'
import type { Trip, WeatherLocation } from '@/types'
import { tripDestinations } from '@/lib/tripDestinations'
import {
  fetchWeatherLocation,
  readWeatherCache,
  weatherCacheKey,
  WEATHER_STALE_MS,
  writeWeatherCache,
} from '@/lib/weather'

interface TripWeatherState {
  locations: WeatherLocation[]
  errors: Record<string, string>
  loading: boolean
  lastUpdated: number | null
}

const MANUAL_REFRESH_COOLDOWN_MS = 60_000

export function useTripWeather(trip: Trip | null | undefined) {
  const [state, setState] = useState<TripWeatherState>({
    locations: [],
    errors: {},
    loading: false,
    lastUpdated: null,
  })
  const [refreshRequest, setRefreshRequest] = useState({ token: 0, force: false })
  const [cooldownUntil, setCooldownUntil] = useState(0)
  // The ref is the actual gate; state only controls the disabled UI.
  const cooldownUntilRef = useRef(0)

  const destinations = useMemo(() => (trip ? tripDestinations(trip) : []), [trip])
  const destinationsKey = useMemo(
    () =>
      destinations
        .map((destination) =>
          [
            destination.id,
            destination.name,
            destination.latitude ?? '',
            destination.longitude ?? '',
            destination.timezone ?? '',
          ].join(':'),
        )
        .join('|'),
    [destinations],
  )

  useEffect(() => {
    let cancelled = false

    if (!trip || destinations.length === 0) {
      setState({ locations: [], errors: {}, loading: false, lastUpdated: null })
      return
    }

    setState((current) => ({
      ...current,
      loading: true,
    }))

    const run = async () => {
      const results = await Promise.all(
        destinations.map(async (destination) => {
          const key = weatherCacheKey(trip.id, destination, trip.startDate, trip.endDate)
          const cached = await readWeatherCache(key)
          let location = cached?.data ?? null
          // A cached result with no usable days is worse than no result: retry it.
          if (location && !location.days.some((day) => day.available)) location = null
          let error: string | null = null
          const online = typeof navigator === 'undefined' || navigator.onLine
          const stale = !cached || Date.now() - cached.fetchedAt > WEATHER_STALE_MS

          const withDestinationDetails = (value: WeatherLocation): WeatherLocation => ({
            ...value,
            destinationId: destination.id,
            name: destination.name || value.name,
            country: destination.country ?? value.country,
            admin1: destination.admin1 ?? value.admin1,
          })

          if (location) location = withDestinationDetails(location)

          if (online && (stale || refreshRequest.force)) {
            try {
              const fresh = withDestinationDetails(
                await fetchWeatherLocation(destination, trip.startDate, trip.endDate),
              )
              if (!fresh.days.some((day) => day.available)) {
                throw new Error('Weather is unavailable for this destination right now.')
              }
              await writeWeatherCache({
                key,
                profileId: trip.profileId,
                tripId: trip.id,
                destinationId: destination.id,
                data: fresh,
              })
              location = fresh
            } catch (cause) {
              if (!location) {
                error = cause instanceof Error ? cause.message : 'Weather is unavailable right now.'
              }
            }
          }

          if (!location && !error) {
            error = 'Weather needs a connection the first time you open this trip.'
          }

          return { destinationId: destination.id, location, error }
        }),
      )

      if (cancelled) return

      const locations: WeatherLocation[] = []
      const errors: Record<string, string> = {}
      for (const result of results) {
        if (result.location) locations.push(result.location)
        if (result.error) errors[result.destinationId] = result.error
      }

      setState({
        locations,
        errors,
        loading: false,
        lastUpdated: locations.length
          ? Math.max(...locations.map((location) => location.fetchedAt))
          : null,
      })
    }

    void run()

    return () => {
      cancelled = true
    }
    // destinationsKey covers the destination fields used above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destinationsKey,
    refreshRequest.token,
    trip?.endDate,
    trip?.id,
    trip?.profileId,
    trip?.startDate,
  ])

  useEffect(() => {
    const refresh = () =>
      setRefreshRequest((current) => ({ token: current.token + 1, force: false }))
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now())
    return () => clearTimeout(timer)
  }, [cooldownUntil])

  return {
    ...state,
    cooldownActive: cooldownUntil > Date.now(),
    // Manual refresh bypasses the client-side freshness check, but not the
    // cooldown gate: re-enabling the button in devtools must not send requests.
    refresh: () => {
      const now = Date.now()
      if (now < cooldownUntilRef.current) return
      cooldownUntilRef.current = now + MANUAL_REFRESH_COOLDOWN_MS
      setCooldownUntil(cooldownUntilRef.current)
      setRefreshRequest((current) => ({ token: current.token + 1, force: true }))
    },
  }
}
