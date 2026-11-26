import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ListChecks,
  Loader2,
  Luggage,
  MapPin,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, PackingItem } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import {
  activityEndDate,
  activityForDate,
  activityScheduleLabel,
  dateRangeLabel,
  eachDayKey,
  formatDay,
  isTimeOrdered,
  occursOn,
  sortActivities,
  tripCountdownLabel,
} from '@/lib/dates'
import { deleteTrip, moveActivityToDay, reorderVisibleActivities, sortDayByTime } from '@/lib/repo'
import { cn, hexAlpha, pluralize } from '@/lib/utils'
import { useToday } from '@/hooks/useToday'
import { useTripWeather } from '@/hooks/useTripWeather'
import { useWeatherUnits } from '@/lib/weatherUnits'
import { tripDestinations } from '@/lib/tripDestinations'
import { useProfile } from '@/context/ProfileContext'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { useActivityViews } from '@/context/ActivityViews'
import { useToast } from '@/context/ToastContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { PlanList } from '@/components/plan/PlanList'
import { TripForm } from '@/components/trips/TripForm'
import { TripMembersSheet } from '@/components/trips/TripMembersSheet'
import { TripShareSheet } from '@/components/trips/TripShareSheet'
import { TripWeatherSection } from '@/components/weather/TripWeatherSection'
import { DayWeatherCard } from '@/components/weather/DayWeatherCard'

interface PlanDragData {
  type: 'plan'
  activityId: string
  date: string
}

interface DayDropData {
  type: 'day'
  date: string
}

interface ActivePlanDrag {
  activity: Activity
  date: string
}

function DayDropZone({ date, children }: { date: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
    data: { type: 'day', date } satisfies DayDropData,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-[28px] transition-colors',
        isOver && 'bg-coral/[0.035] ring-1 ring-inset ring-coral/20',
      )}
    >
      {children}
    </div>
  )
}

function PlanDragPreview({ activity, date }: ActivePlanDrag) {
  const meta = activityMeta(activity.type)
  const Icon = meta.icon
  const instance = activityForDate(activity, date)

  return (
    <div className="pointer-events-none flex gap-2.5 sm:gap-3">
      <span className="w-[50px] shrink-0 sm:w-[58px]" aria-hidden />
      <div
        data-drag-preview
        className="min-w-0 flex-1 rotate-1 rounded-[22px] border border-coral/40 bg-surface p-3.5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-fg/[0.06]"
            style={{ backgroundColor: hexAlpha(meta.color, 0.14), color: meta.color }}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[9px] font-extrabold uppercase tracking-[0.17em]"
              style={{ color: meta.color }}
            >
              {meta.label}
            </p>
            <p className="mt-0.5 break-words text-sm font-extrabold leading-snug text-fg">
              {activity.name}
            </p>
            <p className="mt-1 text-[10px] font-bold text-muted">
              {activityScheduleLabel(instance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { profile } = useProfile()
  const { mode } = useAuth()
  const { syncNow } = useSync()
  const today = useToday()
  const navigate = useNavigate()
  const { openCreate } = useActivityViews()
  const { toast } = useToast()

  const trip = useLiveQuery(async () => {
    if (!tripId) return null
    return (await db.trips.get(tripId)) ?? null
  }, [tripId])

  const activities = useLiveQuery(
    () =>
      tripId
        ? db.activities.where('tripId').equals(tripId).toArray()
        : Promise.resolve([] as Activity[]),
    [tripId],
    [],
  )

  const packingItems = useLiveQuery(
    () =>
      tripId
        ? db.packingItems.where('tripId').equals(tripId).toArray()
        : Promise.resolve([] as PackingItem[]),
    [tripId],
    [] as PackingItem[],
  )

  const weather = useTripWeather(trip)
  const [weatherUnits] = useWeatherUnits()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [activeDrag, setActiveDrag] = useState<ActivePlanDrag | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!activeDrag) return

    const body = document.body
    body.classList.add('is-dragging-plan')
    const preventSelection = (event: Event) => event.preventDefault()
    const preventContextMenu = (event: Event) => event.preventDefault()
    document.addEventListener('selectstart', preventSelection)
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      body.classList.remove('is-dragging-plan')
      document.removeEventListener('selectstart', preventSelection)
      document.removeEventListener('contextmenu', preventContextMenu)
      window.getSelection()?.removeAllRanges()
    }
  }, [activeDrag])

  const dayGroups = useMemo(() => {
    if (!trip) return []

    const allStarts = [trip.startDate, ...activities.map((activity) => activity.date)]
    const allEnds = [trip.endDate, ...activities.map((activity) => activityEndDate(activity))]
    const start = allStarts.sort()[0] ?? trip.startDate
    const end = allEnds.sort().at(-1) ?? trip.endDate

    return eachDayKey(start, end).map((date) => ({
      date,
      activities: sortActivities(
        activities
          .filter((activity) => occursOn(activity, date))
          .map((activity) => activityForDate(activity, date)),
      ),
    }))
  }, [trip, activities])

  const tripsById = useMemo(() => {
    if (!trip) return new Map()
    return new Map([[trip.id, trip]])
  }, [trip])

  if (!profile) return null

  if (trip === undefined) {
    return (
      <Page>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-coral" />
        </div>
      </Page>
    )
  }

  if (trip === null || trip.profileId !== profile.id) {
    return (
      <Page>
        <PageHeader
          title="Trip not found"
          description="This trip might have been deleted, or it belongs to another profile on this device."
          onBack={() => navigate('/trips')}
          backLabel="All trips"
        />
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Nothing to see here."
          description="Head back to your trips and pick another adventure."
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('/trips')}>
              Back to trips
            </button>
          }
        />
      </Page>
    )
  }

  const total = activities.length
  const done = activities.filter((activity) => activity.completed).length
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  const myPackingItems = packingItems?.filter((item) => item.ownerUserId === profile.id) ?? []
  const packingTotal = myPackingItems.length
  const packingDone = myPackingItems.filter((item) => item.packed).length
  const packingProgress = packingTotal === 0 ? 0 : Math.round((packingDone / packingTotal) * 100)
  const isPast = today > trip.endDate
  const destinations = tripDestinations(trip)
  const status = tripCountdownLabel(trip.startDate, trip.endDate, today)
  const isAccount = mode === 'account'
  const isOwner = trip.role !== 'member'
  const addDate = today >= trip.startDate && today <= trip.endDate ? today : trip.startDate

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as PlanDragData | undefined
    if (!data?.activityId || !data.date) return
    const activity = activities.find((item) => item.id === data.activityId)
    if (activity) setActiveDrag({ activity, date: data.date })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null)

    const activeData = event.active.data.current as PlanDragData | undefined
    if (!activeData?.activityId || !activeData.date || !event.over || event.active.id === event.over.id) {
      return
    }

    const overData = event.over.data.current as PlanDragData | DayDropData | undefined
    const targetDate = overData?.date
    if (!targetDate) return

    const source = activities.find((activity) => activity.id === activeData.activityId)
    if (!source) return

    if (activityEndDate(source) !== source.date && targetDate !== activeData.date) {
      toast('Edit the dates to move a multi-day plan.')
      return
    }

    const targetGroup = dayGroups.find((group) => group.date === targetDate)
    if (!targetGroup) return

    const targetIds = targetGroup.activities.map((activity) => activity.id)
    const sourceId = source.id

    if (targetDate === activeData.date) {
      const oldIndex = targetIds.indexOf(sourceId)
      const overId = overData?.type === 'plan' ? overData.activityId : undefined
      const newIndex = overId ? targetIds.indexOf(overId) : targetIds.length - 1
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

      try {
        await reorderVisibleActivities(profile.id, arrayMove(targetIds, oldIndex, newIndex))
      } catch {
        toast('Could not reorder those plans.', 'error')
      }
      return
    }

    const overId = overData?.type === 'plan' ? overData.activityId : undefined
    const filtered = targetIds.filter((id) => id !== sourceId)
    let insertAt = overId ? filtered.indexOf(overId) : filtered.length
    if (insertAt < 0) insertAt = filtered.length

    const nextTarget = [...filtered]
    nextTarget.splice(insertAt, 0, sourceId)

    try {
      await moveActivityToDay(sourceId, targetDate, nextTarget)
    } catch {
      toast('Could not move that plan.', 'error')
    }
  }

  const sortDay = async (date: string) => {
    try {
      await sortDayByTime(profile.id, date)
      toast('Sorted by start time.')
    } catch {
      toast('Could not sort that day.', 'error')
    }
  }

  const removeTrip = async (deletePlans: boolean) => {
    setDeleteBusy(true)
    try {
      await deleteTrip(trip.id, deletePlans)
      toast(deletePlans ? 'Trip and plans deleted.' : 'Trip deleted. The plans are still on your calendar.', 'success')
      navigate('/trips')
    } catch {
      toast('Could not delete that trip.', 'error')
      setDeleteBusy(false)
    }
  }

  return (
    <Page>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/trips')}
          className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-extrabold text-muted transition hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          All trips
        </button>
        <Link to="/search" aria-label="Search everything" className="btn-icon-sm h-9 w-9">
          <Search className="h-4 w-4" />
        </Link>
      </div>

      <section
        className="relative overflow-hidden rounded-[32px] border p-5 sm:p-6"
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
          <div className="flex items-start justify-between gap-3">
            <span
              className="grid h-16 w-16 place-items-center rounded-[22px] border border-fg/15 text-[34px] shadow-inner"
              style={{ backgroundColor: hexAlpha(trip.color, 0.24) }}
            >
              {trip.emoji}
            </span>

            <div className="flex items-center gap-1.5">
              {isAccount && isOwner ? (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="btn-icon h-10 w-10 border-fg/15 bg-fg/10"
                  aria-label="Share trip"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {isAccount ? (
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="btn-icon relative h-10 w-10 border-fg/15 bg-fg/10"
                  aria-label="Trip members"
                >
                  <Users className="h-3.5 w-3.5" />
                  {trip.memberCount ? (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[8px] font-extrabold text-ink">
                      {(trip.memberCount ?? 0) + 1}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="btn-icon h-10 w-10 border-fg/15 bg-fg/10"
                    aria-label="Edit trip"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="btn-icon h-10 w-10 border-fg/15 bg-fg/10 hover:text-punch"
                    aria-label="Delete trip"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-fg backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isPast ? '#A79FB6' : trip.color }} />
              {status}
            </span>
            {trip.role === 'member' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-fg backdrop-blur">
                <Users className="h-3 w-3" />
                Shared with you
              </span>
            ) : trip.memberCount && trip.memberCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-fg backdrop-blur">
                <Users className="h-3 w-3" />
                {(trip.memberCount ?? 0) + 1} travelers
              </span>
            ) : null}
          </div>

          <h1 className="mt-2 break-words text-balance font-display text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-fg sm:text-5xl">
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
              {total === 0 ? 'No plans yet' : `${done} of ${pluralize(total, 'plan')} done`}
            </span>
          </div>

          {total > 0 ? (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: trip.color }}
                />
              </div>
            </div>
          ) : null}

          {trip.notes ? (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-fg/10 bg-fg/[0.04] p-3.5 text-[13px] font-medium leading-relaxed text-fg/75">
              {trip.notes}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => openCreate({ date: addDate, tripId: trip.id })}
            className="btn btn-primary mt-5 h-10 px-4 text-xs"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            Add a plan
          </button>
        </div>
      </section>

      <Link
        to={`/trips/${trip.id}/packing`}
        aria-label={`Open packing list for ${trip.name}`}
        className="group mt-4 flex items-center gap-3.5 rounded-[26px] border border-fg/[0.09] bg-fg/[0.03] p-4 transition hover:border-fg/[0.16] hover:bg-fg/[0.055]"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fg/10"
          style={{ backgroundColor: hexAlpha(trip.color, 0.16), color: trip.color }}
        >
          <Luggage className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-display text-base font-extrabold tracking-[-0.02em] text-fg">
              Your packing list
            </span>
            <span className="text-[10px] font-extrabold text-muted/60">
              {packingTotal === 0 ? 'Empty' : `${packingDone}/${packingTotal}`}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] font-semibold text-muted">
            {packingTotal === 0
              ? 'Start your checklist'
              : `${packingDone} of ${pluralize(packingTotal, 'item')} packed`}
          </span>
          {packingTotal > 0 ? (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-fg/10">
              <span
                className="block h-full rounded-full transition-all duration-500"
                style={{ width: `${packingProgress}%`, backgroundColor: trip.color }}
              />
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </Link>

      <TripWeatherSection
        trip={trip}
        locations={weather.locations}
        errors={weather.errors}
        loading={weather.loading}
        cooldownActive={weather.cooldownActive}
        refresh={weather.refresh}
      />

      <div className="mt-8 flex items-end justify-between">
        <div>
          <p className="eyebrow">The days</p>
          <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-fg">
            Day by day
          </p>
        </div>
        <p className="text-[10px] font-bold text-muted/50">{pluralize(dayGroups.length, 'day')}</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="mt-4 space-y-5">
          {dayGroups.map(({ date, activities: dayActivities }, index) => {
            const dayDone = dayActivities.filter((activity) => activity.completed).length
            const dayTimeOrdered = isTimeOrdered(dayActivities)
            return (
              <section key={date} data-day-date={date}>
                <DayDropZone date={date}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted/60">
                        Day {index + 1}
                      </span>
                      <h3 className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
                        {formatDay(date, 'EEE, MMM d')}
                      </h3>
                      {date === today ? (
                        <span className="rounded-full bg-coral/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-coral">
                          Today
                        </span>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!dayTimeOrdered ? (
                        <span className="rounded-full border border-sun/20 bg-sun/[0.08] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] text-sun">
                          Custom order
                        </span>
                      ) : null}
                      {dayActivities.length > 0 ? (
                        <span className="rounded-full border border-fg/[0.08] bg-fg/[0.03] px-2 py-0.5 text-[9px] font-extrabold text-muted">
                          {dayDone}/{dayActivities.length}
                        </span>
                      ) : null}
                      {dayActivities.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => void sortDay(date)}
                          className="btn-icon-sm h-8 w-8"
                          aria-label={`Sort ${formatDay(date, 'MMMM d')} by start time`}
                          title="Sort by start time"
                        >
                          <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openCreate({ date, tripId: trip.id })}
                        className="btn-icon-sm h-8 w-8"
                        aria-label={`Add a plan on ${formatDay(date, 'MMMM d')}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {!isPast ? (
                    <DayWeatherCard
                      locations={weather.locations}
                      date={date}
                      units={weatherUnits}
                      activities={dayActivities}
                      destinations={destinations}
                    />
                  ) : null}

                  {dayActivities.length > 0 ? (
                    <PlanList
                      profileId={profile.id}
                      activities={dayActivities}
                      tripsById={tripsById}
                      externalDnd
                      instanceDate={date}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCreate({ date, tripId: trip.id })}
                      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-fg/12 p-3.5 text-left transition hover:border-fg/20 hover:bg-fg/[0.03]"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-fg/10 bg-fg/[0.03] text-muted">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 text-xs font-semibold text-muted">
                        Nothing planned — add a stop or leave the day open.
                      </span>
                    </button>
                  )}
                </DayDropZone>
              </section>
            )
          })}
        </div>
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeDrag ? <PlanDragPreview {...activeDrag} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

      {editOpen ? (
        <TripForm trip={trip} onClose={() => setEditOpen(false)} />
      ) : null}

      {membersOpen ? (
        <TripMembersSheet
          trip={trip}
          onClose={() => setMembersOpen(false)}
          onLeft={() => {
            void syncNow()
            navigate('/trips')
          }}
        />
      ) : null}

      {shareOpen ? <TripShareSheet trip={trip} onClose={() => setShareOpen(false)} /> : null}

      <Sheet
        open={deleteOpen}
        onOpenChange={(open) => !open && !deleteBusy && setDeleteOpen(false)}
        title="Delete this trip?"
        description="The days go away, but the plans inside can stay."
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => void removeTrip(true)}
              disabled={deleteBusy}
              className="btn bg-punch text-ink hover:brightness-110"
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {total > 0 ? `Delete trip and all ${pluralize(total, 'plan')}` : 'Delete trip'}
            </button>
            <button
              type="button"
              onClick={() => void removeTrip(false)}
              disabled={deleteBusy}
              className="btn btn-secondary"
            >
              Delete trip, keep the plans
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteBusy}
              className="btn btn-ghost h-9"
            >
              Cancel
            </button>
          </div>
        }
      >
        <p className="text-sm font-medium leading-relaxed text-muted">
          Keeping the plans will leave them on your calendar as loose plans, without the trip attached.
          Deleting them removes their photos and tickets too. The packing list is removed either way.
        </p>
      </Sheet>
    </Page>
  )
}
