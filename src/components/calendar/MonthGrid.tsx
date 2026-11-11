import { useMemo } from 'react'
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Activity } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import { dateKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

interface MonthGridProps {
  cursor: Date
  selected: string
  today: string
  activitiesByDate: Map<string, Activity[]>
  onSelect: (date: string) => void
  weekStartsOn: 0 | 1
}

export function MonthGrid({
  cursor,
  selected,
  today,
  activitiesByDate,
  onSelect,
  weekStartsOn,
}: MonthGridProps) {
  const { days, labels } = useMemo(() => {
    const monthStart = startOfMonth(cursor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn })
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn })
    const interval = eachDayOfInterval({ start: gridStart, end: gridEnd })

    return {
      days: interval,
      labels: Array.from({ length: 7 }, (_, index) => format(addDays(gridStart, index), 'EEEEE')),
    }
  }, [cursor, weekStartsOn])

  return (
    <div>
      <div className="mb-1 grid grid-cols-7">
        {labels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="py-1.5 text-center text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted/60"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = dateKey(day)
          const items = activitiesByDate.get(key) ?? []
          const inMonth = isSameMonth(day, cursor)
          const isSelected = key === selected
          const isToday = key === today
          const types = [...new Set(items.map((item) => item.type))].slice(0, 3)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={`${format(day, 'PPPP')}, ${items.length} ${items.length === 1 ? 'plan' : 'plans'}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              className={cn(
                'group relative flex h-[52px] flex-col items-center justify-center rounded-xl transition-colors sm:h-[58px]',
                isSelected ? 'bg-fg/[0.055]' : 'hover:bg-fg/[0.035]',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold transition-colors',
                  isSelected
                    ? 'bg-coral text-ink shadow-[0_4px_14px_-4px_rgba(0,0,0,0.25)]'
                    : isToday
                      ? 'border border-coral/60 text-coral'
                      : inMonth
                        ? 'text-fg'
                        : 'text-muted/30',
                )}
              >
                {format(day, 'd')}
              </span>

              <span className="mt-0.5 flex h-1.5 items-center justify-center gap-[3px]">
                {types.map((type) => (
                  <span
                    key={type}
                    className={cn('h-1 w-1 rounded-full', !inMonth && 'opacity-30')}
                    style={{ backgroundColor: activityMeta(type).color }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
