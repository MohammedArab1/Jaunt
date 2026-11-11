import type { Activity, Trip } from '@/types'
import { Check, GripVertical, MapPin, Paperclip } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { activityMeta } from '@/lib/activityMeta'
import { formatTimeValue } from '@/lib/dates'
import { cn, hexAlpha } from '@/lib/utils'

interface ActivityCardProps {
  activity: Activity
  trip?: Trip
  attachmentCount: number
  onOpen: () => void
  onToggle: (completed: boolean) => void
  sortable?: boolean
}

export function ActivityCard({
  activity,
  trip,
  attachmentCount,
  onOpen,
  onToggle,
  sortable = false,
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
  } = useSortable({ id: activity.id, disabled: !sortable })

  const completed = activity.completed

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/plan flex gap-2.5 sm:gap-3', isDragging && 'relative z-30')}
    >
      <div className="w-[50px] shrink-0 pt-3.5 text-right sm:w-[58px]">
        {activity.startTime ? (
          <>
            <p
              className={cn(
                'text-[11px] font-extrabold leading-tight tracking-[-0.01em]',
                completed ? 'text-muted/50 line-through' : 'text-cream',
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
          'flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[22px] border bg-white/[0.035] transition-all duration-200',
          completed ? 'border-white/[0.06] bg-white/[0.015]' : 'border-white/[0.09] hover:bg-white/[0.055]',
          isDragging && 'border-coral/40 shadow-2xl shadow-black/50',
        )}
        style={
          completed
            ? undefined
            : {
                borderColor: hexAlpha(meta.color, 0.19),
                background: `linear-gradient(135deg, ${hexAlpha(meta.color, 0.075)}, rgba(255,255,255,0.028) 58%)`,
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
              'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.06]',
              completed && 'opacity-50 grayscale',
            )}
            style={{ backgroundColor: hexAlpha(meta.color, 0.14), color: meta.color }}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>

          <span className="min-w-0 flex-1">
            <span
              className="block text-[9px] font-extrabold uppercase tracking-[0.17em]"
              style={{ color: completed ? undefined : meta.color }}
            >
              {meta.label}
            </span>
            <span
              className={cn(
                'mt-0.5 block break-words text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-cream',
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

            {trip || attachmentCount > 0 || activity.confirmation ? (
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {trip ? (
                  <span
                    className="chip max-w-full gap-1"
                    style={{ backgroundColor: hexAlpha(trip.color, 0.13), color: trip.color }}
                  >
                    <span className="text-[10px] leading-none">{trip.emoji}</span>
                    <span className="truncate">{trip.name}</span>
                  </span>
                ) : null}
                {attachmentCount > 0 ? (
                  <span className="chip bg-white/[0.06] text-muted">
                    <Paperclip className="h-2.5 w-2.5" />
                    {attachmentCount}
                  </span>
                ) : null}
                {activity.confirmation ? (
                  <span className="chip bg-white/[0.06] text-muted">#{activity.confirmation}</span>
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
                : 'border-white/15 text-transparent hover:border-mint/70 hover:text-mint/70',
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
