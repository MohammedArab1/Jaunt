export type WeatherMode = 'forecast' | 'historical' | 'climate'

export interface WeatherDayResult {
  date: string
  mode: WeatherMode
  available: boolean
  weatherCode: number | null
  tempMax: number | null
  tempMin: number | null
  precipProbability: number | null
  precipSum: number | null
  windMax: number | null
  uvMax: number | null
  sunrise: string | null
  sunset: string | null
  rainYears?: number | null
  climateYears?: number | null
}

export interface WeatherHourResult {
  time: string
  temp: number
  weatherCode: number
  precipProbability: number | null
  windSpeed: number | null
  isDay: boolean
}

export interface WeatherCurrentResult {
  time: string
  temp: number
  feelsLike: number | null
  weatherCode: number
  windSpeed: number | null
  isDay: boolean
}

export interface WeatherLocationResult {
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
  days: WeatherDayResult[]
  hourly: WeatherHourResult[]
  current: WeatherCurrentResult | null
  fetchedAt: number
  attribution: { name: string; url: string }
}

export interface WeatherQuery {
  name?: string
  latitude?: number
  longitude?: number
  timezone?: string
  start: string
  end: string
}

export class WeatherError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'WeatherError'
    this.status = status
  }
}

interface ResolvedLocation {
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
}

interface OpenMeteoDaily {
  time?: string[]
  weather_code?: Array<number | null>
  temperature_2m_max?: Array<number | null>
  temperature_2m_min?: Array<number | null>
  precipitation_probability_max?: Array<number | null>
  precipitation_sum?: Array<number | null>
  wind_speed_10m_max?: Array<number | null>
  uv_index_max?: Array<number | null>
  sunrise?: Array<string | null>
  sunset?: Array<string | null>
}

interface OpenMeteoResponse {
  latitude?: number
  longitude?: number
  timezone?: string
  daily?: OpenMeteoDaily
  hourly?: {
    time?: string[]
    temperature_2m?: Array<number | null>
    weather_code?: Array<number | null>
    precipitation_probability?: Array<number | null>
    wind_speed_10m?: Array<number | null>
    is_day?: Array<number | null>
  }
  current?: {
    time?: string
    temperature_2m?: number | null
    apparent_temperature?: number | null
    weather_code?: number | null
    wind_speed_10m?: number | null
    is_day?: number | null
  }
}

interface GeocodePlace {
  id: string
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

const MAX_RANGE_DAYS = 60
// Open-Meteo's 16th day is often incomplete, so use 15 days of forecast
// and switch to climate averages after that.
const FORECAST_DAYS = 15
const RECENT_PAST_DAYS = 5
const CLIMATE_YEARS = 5
const CACHE_MAX_ENTRIES = 400
const FORECAST_CACHE_MS = 3 * 60 * 60 * 1000
const HISTORICAL_CACHE_MS = 24 * 60 * 60 * 1000
const CLIMATE_CACHE_MS = 30 * 24 * 60 * 60 * 1000

const cache = new Map<string, { expires: number; data: WeatherLocationResult }>()
const inFlight = new Map<string, Promise<WeatherLocationResult>>()
const geocodeCache = new Map<string, { expires: number; place: GeocodePlace | null }>()

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function addDays(value: string, days: number): string {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  let cursor = start
  while (cursor <= end && dates.length <= MAX_RANGE_DAYS) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseDate(value)
  return !Number.isNaN(date.getTime()) && isoDate(date) === value
}

function todayInZone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // Fall through to UTC.
  }
  return isoDate(new Date())
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function dailyFromResponse(data: OpenMeteoResponse, mode: WeatherMode): WeatherDayResult[] {
  const daily = data.daily
  const times = daily?.time
  if (!times?.length) return []

  return times.map((date, index) => {
    const tempMax = numberOrNull(daily?.temperature_2m_max?.[index])
    const tempMin = numberOrNull(daily?.temperature_2m_min?.[index])
    return {
      date,
      mode,
      available: tempMax !== null || tempMin !== null,
      weatherCode: numberOrNull(daily?.weather_code?.[index]),
      tempMax,
      tempMin,
      precipProbability: numberOrNull(daily?.precipitation_probability_max?.[index]),
      precipSum: numberOrNull(daily?.precipitation_sum?.[index]),
      windMax: numberOrNull(daily?.wind_speed_10m_max?.[index]),
      uvMax: numberOrNull(daily?.uv_index_max?.[index]),
      sunrise: stringOrNull(daily?.sunrise?.[index]),
      sunset: stringOrNull(daily?.sunset?.[index]),
    }
  })
}

async function fetchJson(url: URL): Promise<OpenMeteoResponse> {
  let response: Response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'Jaunt/1.2 (self-hosted trip planner)' },
    })
  } catch {
    throw new WeatherError('The weather service is unavailable right now.')
  }

  if (!response.ok) {
    throw new WeatherError(`The weather service returned ${response.status}.`)
  }

  try {
    return (await response.json()) as OpenMeteoResponse
  } catch {
    throw new WeatherError('The weather service returned an unexpected response.')
  }
}

async function geocodePlace(query: string): Promise<GeocodePlace | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null

  const cached = geocodeCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.place

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`Geocoding returned ${response.status}`)
    const data = (await response.json()) as {
      results?: Array<{
        id?: number
        name?: string
        country?: string
        admin1?: string
        latitude?: number
        longitude?: number
        timezone?: string
      }>
    }
    const item = data.results?.[0]
    const place =
      item &&
      typeof item.name === 'string' &&
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude)
        ? {
            id: String(item.id ?? item.name),
            name: item.name,
            country: item.country,
            admin1: item.admin1,
            latitude: item.latitude as number,
            longitude: item.longitude as number,
            timezone: item.timezone,
          }
        : null

    if (geocodeCache.size >= CACHE_MAX_ENTRIES) {
      const oldest = geocodeCache.keys().next().value
      if (oldest) geocodeCache.delete(oldest)
    }
    geocodeCache.set(key, { expires: Date.now() + 10 * 60 * 1000, place })
    return place
  } catch {
    return null
  }
}

async function resolveLocation(query: WeatherQuery): Promise<ResolvedLocation> {
  const name = query.name?.trim()
  const hasCoordinates = Number.isFinite(query.latitude) && Number.isFinite(query.longitude)

  if (hasCoordinates) {
    let timezone = query.timezone?.trim()
    if (!timezone && name) {
      const place = await geocodePlace(name)
      timezone = place?.timezone
    }
    return {
      name: name || 'Destination',
      latitude: query.latitude as number,
      longitude: query.longitude as number,
      timezone: timezone || 'UTC',
    }
  }

  if (!name) {
    throw new WeatherError('A city name or coordinates are required.', 400)
  }

  const place = await geocodePlace(name)
  if (!place) {
    throw new WeatherError('Could not find that destination.', 404)
  }

  return {
    name: place.name,
    country: place.country,
    admin1: place.admin1,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || query.timezone?.trim() || 'UTC',
  }
}

async function fetchForecast(
  location: ResolvedLocation,
  start: string,
  end: string,
): Promise<{ days: WeatherDayResult[]; hourly: WeatherHourResult[]; current: WeatherCurrentResult | null }> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(location.latitude))
  url.searchParams.set('longitude', String(location.longitude))
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'uv_index_max',
      'sunrise',
      'sunset',
    ].join(','),
  )
  url.searchParams.set(
    'hourly',
    ['temperature_2m', 'weather_code', 'precipitation_probability', 'wind_speed_10m', 'is_day'].join(','),
  )
  url.searchParams.set(
    'current',
    ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'is_day'].join(','),
  )
  url.searchParams.set('timezone', location.timezone)
  url.searchParams.set('start_date', start)
  url.searchParams.set('end_date', end)

  const data = await fetchJson(url)
  const days = dailyFromResponse(data, 'forecast')
  const hourly: WeatherHourResult[] = []
  const hourlyTimes = data.hourly?.time

  if (hourlyTimes?.length) {
    hourlyTimes.forEach((time, index) => {
      const temp = numberOrNull(data.hourly?.temperature_2m?.[index])
      const code = numberOrNull(data.hourly?.weather_code?.[index])
      if (temp === null || code === null) return
      hourly.push({
        time,
        temp,
        weatherCode: code,
        precipProbability: numberOrNull(data.hourly?.precipitation_probability?.[index]),
        windSpeed: numberOrNull(data.hourly?.wind_speed_10m?.[index]),
        isDay: data.hourly?.is_day?.[index] !== 0,
      })
    })
  }

  const current = data.current
  const currentTemp = numberOrNull(current?.temperature_2m)
  const currentCode = numberOrNull(current?.weather_code)
  const currentResult =
    currentTemp !== null && currentCode !== null
      ? {
          time: current?.time ?? '',
          temp: currentTemp,
          feelsLike: numberOrNull(current?.apparent_temperature),
          weatherCode: currentCode,
          windSpeed: numberOrNull(current?.wind_speed_10m),
          isDay: current?.is_day !== 0,
        }
      : null

  return { days, hourly, current: currentResult }
}

async function fetchArchive(
  location: ResolvedLocation,
  start: string,
  end: string,
): Promise<WeatherDayResult[]> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(location.latitude))
  url.searchParams.set('longitude', String(location.longitude))
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
      'sunrise',
      'sunset',
    ].join(','),
  )
  url.searchParams.set('timezone', location.timezone)
  url.searchParams.set('start_date', start)
  url.searchParams.set('end_date', end)

  const data = await fetchJson(url)
  return dailyFromResponse(data, 'historical')
}

function previousYearDate(date: string, yearsBack: number): string | null {
  const [year, month, day] = date.split('-').map(Number)
  const candidate = new Date(Date.UTC(year - yearsBack, month - 1, day))
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null
  return isoDate(candidate)
}

function mostCommonCode(values: Array<number | null>): number | null {
  const counts = new Map<number, number>()
  for (const value of values) {
    if (value === null) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
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

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

async function fetchClimate(
  location: ResolvedLocation,
  start: string,
  end: string,
): Promise<WeatherDayResult[]> {
  const targetDates = eachDate(start, end)
  const datesByYear = new Map<number, Set<string>>()

  for (const date of targetDates) {
    for (let offset = 1; offset <= CLIMATE_YEARS; offset += 1) {
      const actual = previousYearDate(date, offset)
      if (!actual) continue
      const year = Number(actual.slice(0, 4))
      const set = datesByYear.get(year) ?? new Set<string>()
      set.add(actual)
      datesByYear.set(year, set)
    }
  }

  const rawByDate = new Map<string, WeatherDayResult>()

  await Promise.all(
    [...datesByYear.entries()].map(async ([, dates]) => {
      const ordered = [...dates].sort()
      const rangeStart = ordered[0]
      const rangeEnd = ordered[ordered.length - 1]
      if (!rangeStart || !rangeEnd) return
      try {
        const days = await fetchArchive(location, rangeStart, rangeEnd)
        for (const day of days) rawByDate.set(day.date, day)
      } catch (error) {
        console.error('Climate archive fetch failed:', error)
      }
    }),
  )

  return targetDates.map((date) => {
    const samples: WeatherDayResult[] = []
    for (let offset = 1; offset <= CLIMATE_YEARS; offset += 1) {
      const actual = previousYearDate(date, offset)
      if (!actual) continue
      const sample = rawByDate.get(actual)
      if (sample?.available) samples.push(sample)
    }

    const tempMax = average(samples.map((sample) => sample.tempMax))
    const tempMin = average(samples.map((sample) => sample.tempMin))
    const precipSum = average(samples.map((sample) => sample.precipSum))
    const windMax = average(samples.map((sample) => sample.windMax))
    const rainYears = samples.filter((sample) => (sample.precipSum ?? 0) >= 1).length
    const climateYears = samples.length

    return {
      date,
      mode: 'climate',
      available: climateYears > 0 && (tempMax !== null || tempMin !== null),
      weatherCode: mostCommonCode(samples.map((sample) => sample.weatherCode)),
      tempMax,
      tempMin,
      precipProbability:
        climateYears > 0 ? Math.round((rainYears / climateYears) * 100) : null,
      precipSum,
      windMax,
      uvMax: null,
      sunrise: null,
      sunset: null,
      rainYears,
      climateYears,
    }
  })
}

function unavailableDay(date: string, mode: WeatherMode): WeatherDayResult {
  return {
    date,
    mode,
    available: false,
    weatherCode: null,
    tempMax: null,
    tempMin: null,
    precipProbability: null,
    precipSum: null,
    windMax: null,
    uvMax: null,
    sunrise: null,
    sunset: null,
  }
}

function modeForDate(date: string, today: string): WeatherMode {
  if (date < today) return 'historical'
  if (date <= addDays(today, FORECAST_DAYS - 1)) return 'forecast'
  return 'climate'
}

function cacheTtl(days: WeatherDayResult[]): number {
  if (days.some((day) => day.mode === 'forecast')) return FORECAST_CACHE_MS
  if (days.some((day) => day.mode === 'climate')) return CLIMATE_CACHE_MS
  return HISTORICAL_CACHE_MS
}

function cacheKey(location: ResolvedLocation, start: string, end: string): string {
  return [
    location.latitude.toFixed(3),
    location.longitude.toFixed(3),
    location.timezone,
    start,
    end,
  ].join('|')
}

async function loadWeather(query: WeatherQuery): Promise<WeatherLocationResult> {
  if (!validDate(query.start) || !validDate(query.end)) {
    throw new WeatherError('Invalid weather date range.', 400)
  }
  if (query.end < query.start) {
    throw new WeatherError('The weather end date must come after the start date.', 400)
  }
  if (eachDate(query.start, query.end).length > MAX_RANGE_DAYS) {
    throw new WeatherError(`Weather is limited to ${MAX_RANGE_DAYS} days at a time.`, 400)
  }

  const location = await resolveLocation(query)
  const key = cacheKey(location, query.start, query.end)
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data

  const existing = inFlight.get(key)
  if (existing) return existing

  const request = (async () => {
    const today = todayInZone(location.timezone)
    const forecastStart = addDays(today, -RECENT_PAST_DAYS)
    const forecastEnd = addDays(today, FORECAST_DAYS - 1)
    const archiveEnd = addDays(today, -RECENT_PAST_DAYS - 1)
    const climateStart = addDays(today, FORECAST_DAYS)
    const segments: WeatherDayResult[][] = []
    let hourly: WeatherHourResult[] = []
    let current: WeatherCurrentResult | null = null
    let successes = 0

    const archiveStart = query.start
    const archiveStop = query.end < archiveEnd ? query.end : archiveEnd
    if (archiveStart <= archiveStop) {
      try {
        segments.push(await fetchArchive(location, archiveStart, archiveStop))
        successes += 1
      } catch (error) {
        console.error('Historical weather fetch failed:', error)
      }
    }

    const recentStart = query.start > forecastStart ? query.start : forecastStart
    const recentEnd = query.end < forecastEnd ? query.end : forecastEnd
    if (recentStart <= recentEnd) {
      try {
        const forecast = await fetchForecast(location, recentStart, recentEnd)
        segments.push(
          forecast.days.map((day) =>
            day.date < today ? { ...day, mode: 'historical' as const } : day,
          ),
        )
        successes += 1
        if (query.start <= today && query.end >= today) {
          current = forecast.current
        }
        const hourlyEnd = addDays(today, 2)
        if (query.end >= today && query.start <= hourlyEnd) {
          hourly = forecast.hourly.filter((hour) => {
            const date = hour.time.slice(0, 10)
            return date >= today && date <= hourlyEnd && date >= query.start && date <= query.end
          })
        }
      } catch (error) {
        console.error('Forecast weather fetch failed:', error)
      }
    }

    const climateFrom = query.start > climateStart ? query.start : climateStart
    if (climateFrom <= query.end) {
      try {
        segments.push(await fetchClimate(location, climateFrom, query.end))
        successes += 1
      } catch (error) {
        console.error('Climate weather fetch failed:', error)
      }
    }

    if (successes === 0) {
      throw new WeatherError('Weather is unavailable for this destination right now.')
    }

    const byDate = new Map<string, WeatherDayResult>()
    for (const segment of segments) {
      for (const day of segment) byDate.set(day.date, day)
    }

    const days = eachDate(query.start, query.end).map(
      (date) => byDate.get(date) ?? unavailableDay(date, modeForDate(date, today)),
    )

    const result: WeatherLocationResult = {
      name: location.name,
      country: location.country,
      admin1: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      days,
      hourly,
      current,
      fetchedAt: Date.now(),
      attribution: { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
    }

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    cache.set(key, { expires: Date.now() + cacheTtl(days), data: result })
    return result
  })()

  inFlight.set(key, request)
  try {
    return await request
  } finally {
    inFlight.delete(key)
  }
}

export async function getWeather(query: WeatherQuery): Promise<WeatherLocationResult> {
  return loadWeather(query)
}
