import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WeatherMeta {
  label: string
  Icon: LucideIcon
  tone: string
}

export function weatherMeta(code: number | null | undefined, isDay = true): WeatherMeta {
  if (code === null || code === undefined) {
    return { label: 'Weather unavailable', Icon: Cloud, tone: 'text-muted' }
  }

  if (code === 0) {
    return isDay
      ? { label: 'Clear', Icon: Sun, tone: 'text-sun' }
      : { label: 'Clear', Icon: Moon, tone: 'text-sky' }
  }
  if (code === 1) {
    return isDay
      ? { label: 'Mainly clear', Icon: Sun, tone: 'text-sun' }
      : { label: 'Mainly clear', Icon: Moon, tone: 'text-sky' }
  }
  if (code === 2) {
    return isDay
      ? { label: 'Partly cloudy', Icon: CloudSun, tone: 'text-sun' }
      : { label: 'Partly cloudy', Icon: CloudMoon, tone: 'text-sky' }
  }
  if (code === 3) return { label: 'Overcast', Icon: Cloudy, tone: 'text-muted' }
  if (code === 45 || code === 48) return { label: 'Fog', Icon: CloudFog, tone: 'text-muted' }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return { label: 'Drizzle', Icon: CloudDrizzle, tone: 'text-sky' }
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: 'Rain', Icon: CloudRain, tone: 'text-sky' }
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: 'Snow', Icon: CloudSnow, tone: 'text-violet' }
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Thunderstorm', Icon: CloudLightning, tone: 'text-sun' }
  }

  return { label: 'Mixed weather', Icon: Cloud, tone: 'text-muted' }
}

export function WeatherIcon({
  code,
  isDay = true,
  className,
}: {
  code: number | null | undefined
  isDay?: boolean
  className?: string
}) {
  const meta = weatherMeta(code, isDay)
  const Icon = meta.Icon
  return <Icon aria-label={meta.label} role="img" className={cn('shrink-0', meta.tone, className)} />
}
