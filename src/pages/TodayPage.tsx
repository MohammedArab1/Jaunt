import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, parseISO } from 'date-fns'
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, Trip } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import {
  dateKey,
  formatDay,
  formatTimeValue,
  getUpNext,
  phaseLabel,
  sortActivities,
  tripCountdownLabel,
} from '@/lib/dates'
import { sortDayByTime } from '@/lib/repo'
import { cn, firstName, hexAlpha, pluralize } from '@/lib/utils'
import { useNow, useToday } from '@/hooks/useToday'
import { useProfile } from '@/context/ProfileContext'
import { useActivityViews } from '@/context/ActivityViews'
import { useToast } from '@/context/ToastContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { PlanList } from '@/components/plan/PlanList'

function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TodayPage() {
  const { profile } = useProfile()
  const profileId = profile?.id ?? ''
  const today = useToday()
  const now = useNow()
  const { openCreate, openDetail } = useActivityViews()
  const { toast } = useToast()

  const activities = useLiveQuery(
    () =>
      profileId
        ? db.activities.where('[profileId+date]').equals([profileId, today]).toArray()
        : Promise.resolve([] as Activity[]),
    [profileId, today],
    [],
  )

  const trips = useLiveQuery(
    () => (profileId ? db.trips.where('profileId').equals(profileId).toArray() : Promise.resolve([] as Trip[])),
    [profileId],
    [] as Trip[],
  )

  const tomorrow = dateKey(addDays(parseISO(today), 1))
  const horizon = dateKey(addDays(parseISO(today), 14))

  const upcoming = useLiveQuery(
    () =>
      profileId
        ? db.activities
            .where('[profileId+date]')
            .between([profileId, tomorrow], [profileId, horizon], true, true)
            .toArray()
        : Promise.resolve([] as Activity[]),
    [profileId, tomorrow, horizon],
    [],
  )

  const sorted = useMemo(() => sortActivities(activities), [activities])
  const tripsById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips])
  const upNext = useMemo(() => getUpNext(sorted, now), [sorted, now])
  const completed = sorted.filter((activity) => activity.completed).length
  const allDone = sorted.length > 0 && completed === sorted.length

  const currentTrip = trips.find((trip) => today >= trip.startDate && today <= trip.endDate)
  const nextTrip = useMemo(
    () =>
      trips
        .filter((trip) => trip.startDate > today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0],
    [trips, today],
  )

  const upcomingDays = useMemo(() => {
    const groups = new Map<string, typeof upcoming>()
    for (const activity of upcoming) {
      const list = groups.get(activity.date) ?? []
      list.push(activity)
      groups.set(activity.date, list)
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([date, items]) => ({
        date,
        items: sortActivities(items),
      }))
  }, [upcoming])

  if (!profile) return null

  const phaseMeta = upNext ? activityMeta(upNext.activity.type) : null
  const PhaseIcon = phaseMeta?.icon

  const sortDay = async () => {
    try {
      await sortDayByTime(profile.id, today)
      toast('Sorted by start time.')
    } catch {
      toast('Could not sort the day.', 'error')
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow={formatDay(today, 'EEEE, MMMM d')}
        title={`${greetingFor(now)}, ${firstName(profile.name)}.`}
        actions={
          <Link
            to="/settings"
            aria-label="Open settings"
            className="rounded-full transition hover:opacity-85"
          >
            <Avatar name={profile.name} color={profile.color} />
          </Link>
        }
      />

      {currentTrip ? (
        <Link
          to={`/trips/${currentTrip.id}`}
          className="mb-4 flex items-center gap-3 rounded-2xl border p-2.5 pr-3.5 transition hover:bg-white/[0.05]"
          style={{
            borderColor: hexAlpha(currentTrip.color, 0.2),
            background: `linear-gradient(100deg, ${hexAlpha(currentTrip.color, 0.12)}, rgba(255,255,255,0.02))`,
          }}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-xl text-xl"
            style={{ backgroundColor: hexAlpha(currentTrip.color, 0.18) }}
          >
            {currentTrip.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted">
              On the road
            </span>
            <span className="block truncate text-sm font-extrabold text-cream">
              {currentTrip.name}
              <span className="font-bold text-muted"> · {tripCountdownLabel(currentTrip.startDate, currentTrip.endDate, today)}</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
        </Link>
      ) : nextTrip ? (
        <Link
          to={`/trips/${nextTrip.id}`}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 pr-3.5 transition hover:bg-white/[0.05]"
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-xl text-xl"
            style={{ backgroundColor: hexAlpha(nextTrip.color, 0.18) }}
          >
            {nextTrip.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted">
              Next escape
            </span>
            <span className="block truncate text-sm font-extrabold text-cream">
              {nextTrip.name}
              <span className="font-bold text-muted"> · {tripCountdownLabel(nextTrip.startDate, nextTrip.endDate, today)}</span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" />
        </Link>
      ) : null}

      {upNext && phaseMeta && PhaseIcon ? (
        <button
          type="button"
          onClick={() => openDetail(upNext.activity.id)}
          className="relative w-full overflow-hidden rounded-[30px] border p-5 text-left transition hover:brightness-110 sm:p-6"
          style={{
            borderColor: hexAlpha(phaseMeta.color, 0.3),
            background: `linear-gradient(135deg, ${hexAlpha(phaseMeta.color, 0.3)}, ${hexAlpha(phaseMeta.color, 0.09)} 48%, rgba(23,21,31,0.72))`,
          }}
        >
          <PhaseIcon
            className="pointer-events-none absolute -bottom-8 -right-5 h-44 w-44 opacity-[0.09]"
            strokeWidth={1.2}
          />
          <span
            className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: hexAlpha(phaseMeta.color, 0.2) }}
          />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-cream backdrop-blur"
              >
                {upNext.phase === 'now' ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
                  </span>
                ) : (
                  <Sparkles className="h-2.5 w-2.5" style={{ color: phaseMeta.color }} />
                )}
                {phaseLabel(upNext, now)}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-cream/70">
                Up next
              </span>
            </div>

            <p className="mt-5 line-clamp-3 max-w-[85%] break-words text-balance font-display text-[28px] font-extrabold leading-[0.98] tracking-[-0.035em] text-cream sm:text-4xl">
              {upNext.activity.name}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-bold text-cream/80">
              {upNext.activity.startTime ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: phaseMeta.color }} />
                  {formatTimeValue(upNext.activity.startTime)}
                  {upNext.activity.endTime ? ` – ${formatTimeValue(upNext.activity.endTime)}` : ''}
                </span>
              ) : null}
              {upNext.activity.location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="line-clamp-1">{upNext.activity.location}</span>
                </span>
              ) : null}
              {upNext.activity.tripId && tripsById.get(upNext.activity.tripId) ? (
                <span className="inline-flex items-center gap-1">
                  <span>{tripsById.get(upNext.activity.tripId)?.emoji}</span>
                  {tripsById.get(upNext.activity.tripId)?.name}
                </span>
              ) : null}
            </div>
          </div>
        </button>
      ) : allDone ? (
        <div className="relative overflow-hidden rounded-[30px] border border-mint/25 bg-gradient-to-br from-mint/[0.17] via-white/[0.03] to-transparent p-6">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-mint/15 blur-3xl" />
          <CheckCircle2 className="h-7 w-7 text-mint" />
          <p className="mt-4 font-display text-3xl font-extrabold tracking-[-0.035em] text-cream">
            All done. The day is yours.
          </p>
          <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-muted">
            Every plan is crossed off. Go enjoy the rest of it.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<Sun className="h-6 w-6" />}
          title="A wide-open day."
          description="Nothing on the books yet. Keep it slow, or add something worth leaving the house for."
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <button type="button" className="btn btn-primary" onClick={() => openCreate({ date: today })}>
                <CalendarPlus className="h-4 w-4" />
                Add a plan
              </button>
              <Link to="/trips" className="btn btn-secondary">
                Dream up a trip
              </Link>
            </div>
          }
        />
      )}

      {sorted.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Today's plan</p>
              <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-cream">
                {completed === sorted.length ? 'Every last one' : 'On the docket'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-extrabold text-muted">
                {completed}/{sorted.length} done
              </span>
              <button
                type="button"
                onClick={() => void sortDay()}
                className="btn-icon-sm"
                title="Sort by start time"
                aria-label="Sort plans by start time"
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-coral via-punch to-violet transition-all duration-500"
              style={{ width: `${(completed / sorted.length) * 100}%` }}
            />
          </div>

          <PlanList
            profileId={profile.id}
            date={today}
            activities={sorted}
            tripsById={tripsById}
          />

          <button
            type="button"
            onClick={() => openCreate({ date: today })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 py-3 text-xs font-extrabold text-muted transition hover:border-white/20 hover:bg-white/[0.03] hover:text-cream"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to today
          </button>
        </section>
      ) : null}

      {upcomingDays.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">Coming up</p>
              <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-cream">
                Just around the corner
              </p>
            </div>
            <Link
              to="/calendar"
              className="mb-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-muted transition hover:text-cream"
            >
              Calendar
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {upcomingDays.map(({ date, items }) => {
              const first = items[0]
              const meta = activityMeta(first.type)
              const hidden = items.length - 1
              return (
                <Link
                  key={date}
                  to={`/calendar?date=${date}`}
                  className={cn(
                    'group flex flex-col rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-3.5 transition hover:bg-white/[0.055]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">
                      {date === tomorrow ? 'Tomorrow' : formatDay(date, 'EEE')}
                    </p>
                    <span className="text-[10px] font-extrabold text-muted/60">
                      {pluralize(items.length, 'plan')}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-cream">
                    {formatDay(date, 'MMM d')}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    <p className="min-w-0 truncate text-[11px] font-bold text-cream/80">
                      {first.startTime ? `${formatTimeValue(first.startTime)} · ` : ''}
                      {first.name}
                    </p>
                  </div>
                  {hidden > 0 ? (
                    <p className="mt-1 pl-3 text-[10px] font-bold text-muted/60">+{hidden} more</p>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
    </Page>
  )
}
