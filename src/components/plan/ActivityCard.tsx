import type { Activity, Trip } from '@/types'
import { CalendarRange, Check, GripVertical, MapPin, Paperclip } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { activityMeta } from '@/lib/activityMeta'
import {
  activityDateRangeLabel,
  activitySpansMultipleDays,
  formatTimeSlot,
  formatTimeValue,
} from '@/lib/dates'
import { cn, cssVars, hexAlpha } from '@/lib/utils'
import { ActivityWeatherLine } from '@/components/weather/ActivityWeatherLine'

interface ActivityCardProps {
  activity: Activity
  trip?: Trip
  attachmentCount: number
  onOpen: () => void
  onToggle: (completed: boolean) => void
  sortable?: boolean
  sortableId?: string
  sortableData?: Record<string, unknown>
  showWeather?: boolean
}

export function ActivityCard({
  activity,
  trip,
  attachmentCount,
  onOpen,
  onToggle,
  sortable = false,
  sortableId,
  sortableData,
  showWeather = false,
}: ActivityCardProps) {
  const meta = activityMeta(activity.type)
  const Icon = meta.icon
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: sortableId ?? activity.id,
    disabled: !sortable,
    data: sortableData,
  })

  const completed = activity.completed

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/plan flex gap-2.5 sm:gap-3', isDragging && 'relative z-30')}
    >
      <div className="w-[50px] shrink-0 pt-3.5 text-right sm:w-[58px]">
        {activity.timeSlot ? (
          <p
            className={cn(
              'text-[8px] font-extrabold uppercase leading-tight tracking-[0.04em]',
              completed ? 'text-muted/50 line-through' : 'text-fg',
            )}
          >
            {formatTimeSlot(activity.timeSlot)}
          </p>
        ) : activity.startTime ? (
          <>
            <p
              className={cn(
                'text-[11px] font-extrabold leading-tight tracking-[-0.01em]',
                completed ? 'text-muted/50 line-through' : 'text-fg',
              )}
            >
              {formatTimeValue(activity.startTime)}
            </p>
            {activity.endTime ? (
              <p className="mt-0.5 text-[9px] font-bold text-muted/60">{formatTimeValue(activity.endTime)}</p>
            ) : null}
          </>
        ) : (
          <p className="pt-0.5 text-[9px] font-extrabold uppercase leading-tight tracking-[0.08em] text-muted/70">
            Any time
          </p>
        )}
      </div>

      <article
        className={cn(
          'flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[22px] border bg-fg/[0.035] transition-all duration-200',
          completed ? 'border-fg/[0.06] bg-fg/[0.015]' : 'border-fg/[0.09] hover:bg-fg/[0.055]',
          isDragging && 'border-coral/40 shadow-2xl shadow-black/50',
          isOver && !isDragging && 'ring-2 ring-coral/25',
        )}
        style={
          completed
            ? undefined
            : {
                borderColor: hexAlpha(meta.color, 0.19),
                background: `linear-gradient(135deg, ${hexAlpha(meta.color, 0.075)}, var(--color-sheen) 58%)`,
              }
        }
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 p-3.5 text-left outline-none sm:gap-3.5"
          aria-label={`View ${activity.name}`}
        >
          <span
            className={cn(
              'type-color-text mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-fg/[0.06]',
              completed && 'opacity-50 grayscale',
            )}
            style={{ ...cssVars({ '--type-color': meta.color }), backgroundColor: hexAlpha(meta.color, 0.14) }}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block text-[9px] font-extrabold uppercase tracking-[0.17em]',
                completed ? 'text-muted/50' : 'type-color-text',
              )}
              style={completed ? undefined : cssVars({ '--type-color': meta.color })}
            >
              {meta.label}
            </span>
            <span
              className={cn(
                'mt-0.5 block break-words text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-fg',
                completed && 'text-muted/60 line-through decoration-muted/40',
              )}
            >
              {activity.name}
            </span>

            {activity.location ? (
              <span className="mt-1.5 flex break-words items-start gap-1 text-[11px] font-semibold leading-snug text-muted">
                <MapPin className="mt-px h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{activity.location}</span>
              </span>
            ) : null}

            {showWeather && trip && activity.destinationId ? (
              <ActivityWeatherLine activity={activity} trip={trip} />
            ) : null}

            {trip || attachmentCount > 0 || activity.confirmation || activitySpansMultipleDays(activity) ? (
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {activitySpansMultipleDays(activity) ? (
                  <span className="chip bg-violet/15 text-violet">
                    <CalendarRange className="h-2.5 w-2.5" />
                    {activityDateRangeLabel(activity)}
                  </span>
                ) : null}
                {trip ? (
                  <span
                    className="trip-color-text chip max-w-full gap-1"
                    style={{ ...cssVars({ '--trip-color': trip.color }), backgroundColor: hexAlpha(trip.color, 0.13) }}
                  >
                    <span className="text-[10px] leading-none">{trip.emoji}</span>
                    <span className="truncate">{trip.name}</span>
                  </span>
                ) : null}
                {attachmentCount > 0 ? (
                  <span className="chip bg-fg/[0.06] text-muted">
                    <Paperclip className="h-2.5 w-2.5" />
                    {attachmentCount}
                  </span>
                ) : null}
                {activity.confirmation ? (
                  <span className="chip bg-fg/[0.06] text-muted">#{activity.confirmation}</span>
                ) : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2.5 pr-1">
          <button
            type="button"
            onClick={() => onToggle(!completed)}
            aria-label={completed ? `Mark ${activity.name} as not done` : `Mark ${activity.name} as done`}
            aria-pressed={completed}
            className={cn(
              'grid h-9 w-9 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90',
              completed
                ? 'border-mint bg-mint text-ink'
                : 'border-fg/15 text-transparent hover:border-mint/70 hover:text-mint/70',
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>

          {sortable ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              onClick={(event) => event.stopPropagation()}
              className="touch-none cursor-grab rounded-lg p-1.5 text-muted/35 outline-none transition hover:text-muted active:cursor-grabbing"
              aria-label={`Reorder ${activity.name}`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>
    </div>
  )
}
