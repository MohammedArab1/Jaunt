import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  ArrowDownWideNarrow,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, Trip } from '@/types'
import { dateKey, formatDay, sortActivities } from '@/lib/dates'
import { sortDayByTime } from '@/lib/repo'
import { cn, hexAlpha, pluralize } from '@/lib/utils'
import { useToday } from '@/hooks/useToday'
import { useProfile } from '@/context/ProfileContext'
import { useActivityViews } from '@/context/ActivityViews'
import { useToast } from '@/context/ToastContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { PlanList } from '@/components/plan/PlanList'

const WEEK_STARTS_ON: 0 | 1 =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en-us') ? 0 : 1

function isDateParam(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)))
}

export function CalendarPage() {
  const { profile } = useProfile()
  const profileId = profile?.id ?? ''
  const today = useToday()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramDate = searchParams.get('date')
  const initialDate = isDateParam(paramDate) ? paramDate : today
  const [selected, setSelected] = useState(initialDate)
  const [cursor, setCursor] = useState(() => startOfMonth(parseISO(initialDate)))
  const { openCreate } = useActivityViews()
  const { toast } = useToast()

  useEffect(() => {
    if (isDateParam(paramDate) && paramDate !== selected) {
      setSelected(paramDate)
      setCursor(startOfMonth(parseISO(paramDate)))
    }
    // React to external links into the calendar without fighting local selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramDate])

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON })
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON })
  const rangeStart = dateKey(gridStart)
  const rangeEnd = dateKey(gridEnd)

  const monthActivities = useLiveQuery(
    () =>
      profileId
        ? db.activities
            .where('[profileId+date]')
            .between([profileId, rangeStart], [profileId, rangeEnd], true, true)
            .toArray()
        : Promise.resolve([] as Activity[]),
    [profileId, rangeStart, rangeEnd],
    [],
  )

  const selectedActivities = useLiveQuery(
    () =>
      profileId
        ? db.activities.where('[profileId+date]').equals([profileId, selected]).toArray()
        : Promise.resolve([] as Activity[]),
    [profileId, selected],
    [],
  )

  const trips = useLiveQuery(
    () => (profileId ? db.trips.where('profileId').equals(profileId).toArray() : Promise.resolve([] as Trip[])),
    [profileId],
    [] as Trip[],
  )

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of monthActivities) {
      const list = map.get(activity.date) ?? []
      list.push(activity)
      map.set(activity.date, list)
    }
    return map
  }, [monthActivities])

  const selectedSorted = useMemo(() => sortActivities(selectedActivities), [selectedActivities])
  const tripsById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips])
  const selectedTrips = trips.filter((trip) => selected >= trip.startDate && selected <= trip.endDate)
  const selectedCompleted = selectedSorted.filter((activity) => activity.completed).length

  const monthStartKey = dateKey(startOfMonth(cursor))
  const monthEndKey = dateKey(endOfMonth(cursor))
  const monthPlans = monthActivities.filter((activity) => activity.date >= monthStartKey && activity.date <= monthEndKey)
  const monthTrips = trips.filter((trip) => trip.startDate <= monthEndKey && trip.endDate >= monthStartKey)
  const isCurrentMonth = format(cursor, 'yyyy-MM') === format(parseISO(today), 'yyyy-MM')

  if (!profile) return null

  const selectDate = (date: string) => {
    setSelected(date)
    setCursor(startOfMonth(parseISO(date)))
    setSearchParams({ date }, { replace: true })
  }

  const goToday = () => {
    selectDate(today)
  }

  const sortSelected = async () => {
    try {
      await sortDayByTime(profile.id, selected)
      toast('Sorted by start time.')
    } catch {
      toast('Could not sort that day.', 'error')
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow={formatDay(today, 'EEEE, MMMM d')}
        title="Calendar"
        description="Pick any day ahead. Add what matters, leave room for what doesn't."
        actions={
          <button
            type="button"
            onClick={() => openCreate({ date: selected })}
            className="btn btn-primary h-10 px-4 text-xs"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            Add
          </button>
        }
      />

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 pt-3.5 sm:px-4">
          <button
            type="button"
            onClick={() => setCursor((current) => addMonths(current, -1))}
            className="btn-icon-sm"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="text-center">
            <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-cream sm:text-2xl">
              {format(cursor, 'MMMM yyyy')}
            </h2>
            <p className="mt-0.5 text-[10px] font-bold text-muted">
              {pluralize(monthPlans.length, 'plan')} · {pluralize(monthTrips.length, 'trip')}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {!isCurrentMonth ? (
              <button
                type="button"
                onClick={goToday}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted transition hover:text-cream"
              >
                Today
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCursor((current) => addMonths(current, 1))}
              className="btn-icon-sm"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-2 pb-3 sm:px-3">
          <MonthGrid
            cursor={cursor}
            selected={selected}
            today={today}
            activitiesByDate={activitiesByDate}
            onSelect={selectDate}
            weekStartsOn={WEEK_STARTS_ON}
          />
        </div>
      </div>

      <section className="surface mt-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-end gap-2.5">
            <span className="font-display text-[2.8rem] font-extrabold leading-none tracking-[-0.06em] text-cream">
              {formatDay(selected, 'd')}
            </span>
            <div className="pb-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
                  {formatDay(selected, 'EEEE')}
                </p>
                {selected === today ? (
                  <span className="rounded-full bg-coral/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-coral">
                    Today
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-bold text-muted">
                {formatDay(selected, 'MMMM yyyy')}
                <span className="mx-1.5 text-white/20">·</span>
                {selectedSorted.length === 0
                  ? 'wide open'
                  : `${selectedCompleted}/${selectedSorted.length} done`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {selectedSorted.length > 1 ? (
              <button
                type="button"
                onClick={() => void sortSelected()}
                className="btn-icon-sm"
                title="Sort by start time"
                aria-label="Sort plans by start time"
              >
                <ArrowDownWideNarrow className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => openCreate({ date: selected })}
              className="btn-icon h-10 w-10 border-0 bg-coral text-ink hover:bg-[#ff7d61]"
              aria-label={`Add a plan on ${formatDay(selected, 'MMMM d')}`}
            >
              <Plus className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        </div>

        {selectedTrips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="chip max-w-full"
                style={{ backgroundColor: hexAlpha(trip.color, 0.13), color: trip.color }}
              >
                <span>{trip.emoji}</span>
                <span className="truncate">{trip.name}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {selectedSorted.length > 0 ? (
            <PlanList
              profileId={profile.id}
              date={selected}
              activities={selectedSorted}
              tripsById={tripsById}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-muted">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <p className={cn('font-display text-lg font-extrabold tracking-[-0.02em] text-cream')}>
                A little breathing room
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs font-medium leading-relaxed text-muted">
                Nothing planned on this day yet. Add something, or keep it beautifully empty.
              </p>
              <button
                type="button"
                onClick={() => openCreate({ date: selected })}
                className="btn btn-secondary mt-4 h-9 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a plan
              </button>
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
