import { useEffect, useState } from 'react'

export type WeatherUnits = 'metric' | 'imperial'

const STORAGE_KEY = 'jaunt.weatherUnits'
const CHANGE_EVENT = 'jaunt:weather-units'

function defaultUnits(): WeatherUnits {
  try {
    return /^en-US\b/i.test(navigator.language) ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export function getWeatherUnits(): WeatherUnits {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'metric' || stored === 'imperial') return stored
  } catch {
    // Fall back to the locale default.
  }
  return defaultUnits()
}

export function setWeatherUnits(units: WeatherUnits): void {
  try {
    localStorage.setItem(STORAGE_KEY, units)
  } catch {
    // The preference is best effort.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useWeatherUnits(): [WeatherUnits, (units: WeatherUnits) => void] {
  const [units, setUnits] = useState<WeatherUnits>(getWeatherUnits)

  useEffect(() => {
    const update = () => setUnits(getWeatherUnits())
    window.addEventListener(CHANGE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(CHANGE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return [units, setWeatherUnits]
}

export function temperatureValue(celsius: number | null | undefined, units: WeatherUnits): number | null {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return null
  return units === 'imperial' ? (celsius * 9) / 5 + 32 : celsius
}

export function formatTemp(celsius: number | null | undefined, units: WeatherUnits): string {
  const value = temperatureValue(celsius, units)
  return value === null ? '—' : `${Math.round(value)}°`
}

export function temperatureUnit(units: WeatherUnits): string {
  return units === 'imperial' ? '°F' : '°C'
}

export function formatWind(kmh: number | null | undefined, units: WeatherUnits): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return '—'
  const value = units === 'imperial' ? kmh * 0.621371 : kmh
  return `${Math.round(value)} ${units === 'imperial' ? 'mph' : 'km/h'}`
}

export function formatPrecip(mm: number | null | undefined, units: WeatherUnits): string {
  if (mm === null || mm === undefined || !Number.isFinite(mm)) return '—'
  if (units === 'imperial') {
    const inches = mm / 25.4
    return `${inches < 0.1 ? inches.toFixed(2) : inches.toFixed(1)} in`
  }
  return `${mm < 0.1 ? mm.toFixed(1) : Math.round(mm * 10) / 10} mm`
}

export function formatUv(uv: number | null | undefined): string {
  if (uv === null || uv === undefined || !Number.isFinite(uv)) return '—'
  return String(Math.round(uv * 10) / 10)
}
