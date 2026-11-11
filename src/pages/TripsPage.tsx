import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Luggage, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, Trip } from '@/types'
import { useToday } from '@/hooks/useToday'
import { useProfile } from '@/context/ProfileContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { TripCard } from '@/components/trips/TripCard'
import { TripForm } from '@/components/trips/TripForm'

export function TripsPage() {
  const { profile } = useProfile()
  const profileId = profile?.id ?? ''
  const today = useToday()
  const navigate = useNavigate()
  const [newTripOpen, setNewTripOpen] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const trips = useLiveQuery(
    () => (profileId ? db.trips.where('profileId').equals(profileId).toArray() : Promise.resolve([] as Trip[])),
    [profileId],
    [] as Trip[],
  )

  const activities = useLiveQuery(
    () => (profileId ? db.activities.where('profileId').equals(profileId).toArray() : Promise.resolve([] as Activity[])),
    [profileId],
    [] as Activity[],
  )

  const counts = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    for (const activity of activities) {
      if (!activity.tripId) continue
      const current = map.get(activity.tripId) ?? { total: 0, done: 0 }
      current.total += 1
      if (activity.completed) current.done += 1
      map.set(activity.tripId, current)
    }
    return map
  }, [activities])

  const upcoming = useMemo(
    () =>
      trips
        .filter((trip) => trip.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [trips, today],
  )

  const past = useMemo(
    () =>
      trips
        .filter((trip) => trip.endDate < today)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [trips, today],
  )

  if (!profile) return null

  return (
    <Page>
      <PageHeader
        eyebrow="The big picture"
        title="Trips"
        description="Weekenders, big flights, and everything worth counting down to."
        actions={
          <button
            type="button"
            onClick={() => setNewTripOpen(true)}
            className="btn btn-primary h-10 px-4 text-xs"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            New trip
          </button>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          icon={<Luggage className="h-6 w-6" />}
          title="No trips on the books."
          description="A weekend, a flight, a cabin with no Wi-Fi — start with the dates and build the days from there."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setNewTripOpen(true)}>
              <Plus className="h-4 w-4" />
              Plan your first trip
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">On the road & upcoming</p>
              <span className="text-[10px] font-extrabold text-muted/50">{upcoming.length}</span>
            </div>

            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((trip) => {
                  const count = counts.get(trip.id) ?? { total: 0, done: 0 }
                  return (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      today={today}
                      planCount={count.total}
                      doneCount={count.done}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/12 px-6 py-8 text-center">
                <p className="font-display text-lg font-extrabold tracking-[-0.02em] text-cream">
                  The calendar's clear.
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs font-medium leading-relaxed text-muted">
                  No trips ahead right now. A change of scenery might be in order.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary mt-4 h-9 px-4 text-xs"
                  onClick={() => setNewTripOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Plan a trip
                </button>
              </div>
            )}
          </section>

          {past.length > 0 ? (
            <section>
              <button
                type="button"
                onClick={() => setShowPast((current) => !current)}
                className="mb-3 flex w-full items-center justify-between rounded-xl py-1 text-left"
                aria-expanded={showPast}
              >
                <span className="eyebrow">Past trips</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-muted/50">
                  {past.length}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {showPast ? (
                <div className="space-y-3">
                  {past.map((trip) => {
                    const count = counts.get(trip.id) ?? { total: 0, done: 0 }
                    return (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        today={today}
                        planCount={count.total}
                        doneCount={count.done}
                        past
                      />
                    )
                  })}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      {newTripOpen ? (
        <TripForm
          onClose={() => setNewTripOpen(false)}
          onSaved={(trip) => navigate(`/trips/${trip.id}`)}
        />
      ) : null}
    </Page>
  )
}
