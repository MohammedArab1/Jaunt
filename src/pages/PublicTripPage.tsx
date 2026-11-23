import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  ListChecks,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { ApiError, api, isNetworkError } from '@/lib/api'
import type { PublicTripActivity, PublicTripPayload } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import {
  activityDateRangeLabel,
  activityEndDate,
  activityForDate,
  activityScheduleLabel,
  activitySpansMultipleDays,
  activityTimeRank,
  dateRangeLabel,
  eachDayKey,
  formatDay,
} from '@/lib/dates'
import { cssVars, hexAlpha, pluralize } from '@/lib/utils'
import { Wordmark } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { TypeBadge } from '@/components/ui/TypeBadge'
import { EmptyState } from '@/components/ui/EmptyState'

interface PublicTripPageProps {
  token: string
}

export function PublicTripPage({ token }: PublicTripPageProps) {
  const [payload, setPayload] = useState<PublicTripPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const next = await api.publicTrip(token)
        if (!cancelled) setPayload(next)
      } catch (cause) {
        if (cancelled) return
        setPayload(null)
        if (cause instanceof ApiError && cause.status === 404) {
          setNotFound(true)
        } else if (isNetworkError(cause)) {
          setError('Could not reach the Jaunt server. Check your connection and try again.')
        } else {
          setError('Could not load this shared itinerary.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, retry])

  useEffect(() => {
    const previous = document.title
    document.title = payload ? `${payload.trip.name} · Jaunt` : 'Shared itinerary · Jaunt'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.title = previous
      meta.remove()
    }
  }, [payload])

  const dayGroups = useMemo(() => {
    if (!payload) return []

    const { trip, activities } = payload
    const starts = [trip.startDate, ...activities.map((activity) => activity.date)]
    const ends = [trip.endDate, ...activities.map((activity) => activityEndDate(activity))]
    const start = starts.toSorted()[0] ?? trip.startDate
    const end = ends.toSorted().at(-1) ?? trip.endDate

    return eachDayKey(start, end).map((date) => ({
      date,
      activities: activities
        .filter((activity) => activity.date <= date && activityEndDate(activity) >= date)
        .map((activity) => activityForDate(activity, date))
        .sort(
          (a, b) =>
            activityTimeRank(a) - activityTimeRank(b) ||
            a.sortOrder - b.sortOrder ||
            a.createdAt - b.createdAt,
        ),
    }))
  }, [payload])

  if (loading) {
    return (
      <div className="relative min-h-dvh">
        <div className="app-ambient" aria-hidden />
        <div className="relative z-10 grid min-h-dvh place-items-center">
          <Loader2 className="h-7 w-7 animate-spin text-coral" />
        </div>
      </div>
    )
  }

  if (notFound || !payload) {
    return (
      <div className="relative min-h-dvh">
        <div className="app-ambient" aria-hidden />
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
          <Wordmark markSize={30} />
          <div className="mt-10 w-full">
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title={notFound ? 'This link is no longer available.' : 'Could not load this itinerary.'}
              description={
                notFound
                  ? 'The owner may have turned off sharing, or the trip may have been deleted.'
                  : (error ?? 'Check your connection and try again.')
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!notFound ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Try again
                    </button>
                  ) : null}
                  <Link to="/" className="btn btn-primary">
                    Open Jaunt
                  </Link>
                </div>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const { trip, activities } = payload

  return (
    <div className="relative min-h-dvh">
      <div className="app-ambient" aria-hidden />
      <div className="page-enter relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:px-10 lg:pt-12">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex rounded-xl" aria-label="Open Jaunt">
            <Wordmark markSize={30} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fg/10 bg-fg/[0.04] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted">
              <ShieldCheck className="h-3 w-3" />
              Read-only
            </span>
            <ThemeToggle />
          </div>
        </header>

        <section
          className="relative mt-8 overflow-hidden rounded-[32px] border p-5 sm:p-6"
          style={{
            borderColor: hexAlpha(trip.color, 0.26),
            background: `radial-gradient(130% 150% at 0% 0%, ${hexAlpha(trip.color, 0.36)}, transparent 58%), linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))`,
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: hexAlpha(trip.color, 0.18) }}
            aria-hidden
          />
          <div className="relative">
            <span
              className="grid h-16 w-16 place-items-center rounded-[22px] border border-fg/15 text-[34px] shadow-inner"
              style={{ backgroundColor: hexAlpha(trip.color, 0.24) }}
            >
              {trip.emoji}
            </span>

            <h1 className="mt-4 break-words text-balance font-display text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-fg sm:text-5xl">
              {trip.name}
            </h1>

            {trip.destination ? (
              <p className="mt-2 flex min-w-0 items-start gap-1.5 text-sm font-bold text-fg/80">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{trip.destination}</span>
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-fg/70">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateRangeLabel(trip.startDate, trip.endDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                {activities.length === 0 ? 'No plans yet' : pluralize(activities.length, 'plan')}
              </span>
            </div>

            <p className="mt-4 text-[11px] font-semibold text-muted">Shared by {trip.ownerName}</p>
          </div>
        </section>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The itinerary</p>
            <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-fg">
              Day by day
            </p>
          </div>
          <p className="text-[10px] font-bold text-muted/50">{pluralize(dayGroups.length, 'day')}</p>
        </div>

        <div className="mt-4 space-y-6">
          {dayGroups.map(({ date, activities: dayActivities }, index) => (
            <section key={date}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted/60">
                    Day {index + 1}
                  </span>
                  <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
                    {formatDay(date, 'EEEE, MMM d')}
                  </h2>
                </div>
                {dayActivities.length > 0 ? (
                  <span className="rounded-full border border-fg/[0.08] bg-fg/[0.03] px-2 py-0.5 text-[9px] font-extrabold text-muted">
                    {dayActivities.length}
                  </span>
                ) : null}
              </div>

              {dayActivities.length > 0 ? (
                <div className="space-y-2.5">
                  {dayActivities.map((activity) => (
                    <PublicPlanCard key={`${date}-${activity.id}`} activity={activity} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-fg/12 px-3.5 py-3 text-xs font-medium text-muted">
                  Nothing planned — a free day.
                </p>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-fg/[0.06] pt-6 text-center">
          <Link to="/" className="inline-flex rounded-xl" aria-label="Open Jaunt">
            <Wordmark markSize={24} />
          </Link>
          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted/50">
            Made with Jaunt
          </p>
          <p className="mx-auto mt-1 max-w-md text-[10px] font-medium leading-relaxed text-muted/60">
            This is a read-only shared itinerary. Tickets, confirmation numbers, links, and notes stay
            private.
          </p>
          <Link to="/" className="btn btn-primary mt-4 h-9 px-4 text-xs">
            <ArrowRight className="h-3.5 w-3.5" />
            Plan your own trip
          </Link>
        </footer>
      </div>
    </div>
  )
}

function PublicPlanCard({ activity }: { activity: PublicTripActivity }) {
  const meta = activityMeta(activity.type)
  const Icon = meta.icon

  return (
    <div className="rounded-[22px] border border-fg/[0.07] bg-fg/[0.03] p-3.5">
      <div className="flex items-start gap-3">
        <span
          className="type-color-text mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-fg/[0.08]"
          style={{
            ...cssVars({ '--type-color': meta.color }),
            backgroundColor: hexAlpha(meta.color, 0.14),
          }}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words font-display text-lg font-extrabold leading-tight tracking-[-0.02em] text-fg">
              {activity.name}
            </p>
            {activity.completed ? (
              <span className="chip shrink-0 bg-mint/15 text-mint">
                <Check className="h-3 w-3" /> Done
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-muted">
            <TypeBadge type={activity.type} />
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {activityScheduleLabel(activity)}
            </span>
            {activity.location ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="break-words">{activity.location}</span>
              </span>
            ) : null}
            {activitySpansMultipleDays(activity) ? (
              <span className="inline-flex items-center gap-1 text-violet">
                <CalendarDays className="h-3 w-3" />
                {activityDateRangeLabel(activity)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
