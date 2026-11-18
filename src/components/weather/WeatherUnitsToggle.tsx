import { useWeatherUnits } from '@/lib/weatherUnits'
import { cn } from '@/lib/utils'

export function WeatherUnitsToggle({ className }: { className?: string }) {
  const [units, setUnits] = useWeatherUnits()

  return (
    <div
      role="group"
      aria-label="Weather units"
      className={cn('inline-flex rounded-full border border-fg/10 bg-fg/[0.03] p-0.5', className)}
    >
      {(['metric', 'imperial'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setUnits(option)}
          aria-pressed={units === option}
          className={cn(
            'rounded-full px-2 py-1 text-[9px] font-extrabold transition',
            units === option ? 'bg-fg/10 text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {option === 'metric' ? '°C' : '°F'}
        </button>
      ))}
    </div>
  )
}
