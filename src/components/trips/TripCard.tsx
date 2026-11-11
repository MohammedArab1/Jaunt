import { CalendarDays, ChevronRight, ListChecks, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Trip } from '@/types'
import { compactDateRange, tripCountdownLabel } from '@/lib/dates'
import { cn, hexAlpha } from '@/lib/utils'

interface TripCardProps {
  trip: Trip
  today: string
  planCount: number
  doneCount: number
  past?: boolean
}

export function TripCard({ trip, today, planCount, doneCount, past = false }: TripCardProps) {
  const countdown = tripCountdownLabel(trip.startDate, trip.endDate, today)
  const active = today >= trip.startDate && today <= trip.endDate

  return (
    <Link
      to={`/trips/${trip.id}`}
      className={cn(
        'group flex overflow-hidden rounded-[26px] border border-white/[0.09] bg-white/[0.03] transition-all hover:border-white/[0.16] hover:bg-white/[0.055]',
        past && 'opacity-65 hover:opacity-100',
      )}
    >
      <div
        className="relative grid w-[104px] shrink-0 place-items-center overflow-hidden sm:w-[132px]"
        style={{
          background: `linear-gradient(150deg, ${trip.color}, ${hexAlpha(trip.color, 0.48)})`,
        }}
      >
        <span
          className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full border border-white/20"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-black/10"
          aria-hidden
        />
        <span className="relative text-[40px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.3)] sm:text-[52px]">
          {trip.emoji}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em]"
            style={{ backgroundColor: hexAlpha(trip.color, 0.13), color: trip.color }}
          >
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
            {countdown}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-cream" />
        </div>

        <h3 className="mt-2 truncate font-display text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-cream">
          {trip.name}
        </h3>

        {trip.destination ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-muted">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{trip.destination}</span>
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted/80">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {compactDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {planCount === 0 ? 'No plans yet' : `${doneCount}/${planCount} done`}
          </span>
        </div>
      </div>
    </Link>
  )
}
