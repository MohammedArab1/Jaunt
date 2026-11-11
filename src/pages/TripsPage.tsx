import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Loader2, Luggage, Mail, Plus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, Trip, TripInvite } from '@/types'
import { useToday } from '@/hooks/useToday'
import { useProfile } from '@/context/ProfileContext'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'
import { compactDateRange } from '@/lib/dates'
import { getErrorMessage, hexAlpha } from '@/lib/utils'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { TripCard } from '@/components/trips/TripCard'
import { TripForm } from '@/components/trips/TripForm'

export function TripsPage() {
  const { profile } = useProfile()
  const { mode } = useAuth()
  const { syncNow } = useSync()
  const { toast } = useToast()
  const profileId = profile?.id ?? ''
  const today = useToday()
  const navigate = useNavigate()
  const [newTripOpen, setNewTripOpen] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [invites, setInvites] = useState<TripInvite[]>([])
  const [inviteBusy, setInviteBusy] = useState<string | null>(null)

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

  useEffect(() => {
    if (mode !== 'account') return
    let cancelled = false

    const load = async () => {
      try {
        const response = await api.invites.list()
        if (!cancelled) setInvites(response.invites)
      } catch {
        // Invitations are best-effort; the page still works offline.
      }
    }

    void load()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [mode])

  const acceptInvite = async (invite: TripInvite) => {
    setInviteBusy(invite.tripId)
    try {
      await api.invites.accept(invite.tripId)
      setInvites((current) => current.filter((item) => item.tripId !== invite.tripId))
      toast('Trip added to your trips.', 'success')
      await syncNow()
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setInviteBusy(null)
    }
  }

  const declineInvite = async (invite: TripInvite) => {
    setInviteBusy(invite.tripId)
    try {
      await api.invites.decline(invite.tripId)
      setInvites((current) => current.filter((item) => item.tripId !== invite.tripId))
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setInviteBusy(null)
    }
  }

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

      {invites.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-coral" />
            <p className="eyebrow">Trip invitations</p>
          </div>
          <div className="space-y-2.5">
            {invites.map((invite) => (
              <div
                key={invite.tripId}
                className="overflow-hidden rounded-[24px] border border-coral/20"
                style={{
                  background: `linear-gradient(135deg, ${hexAlpha(invite.color, 0.16)}, var(--color-sheen))`,
                }}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl"
                    style={{ backgroundColor: hexAlpha(invite.color, 0.22) }}
                  >
                    {invite.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
                      {invite.name}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted">
                      From {invite.ownerName} · {compactDateRange(invite.startDate, invite.endDate)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted/60">
                      <Users className="h-3 w-3" />
                      You've been invited to plan together
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-fg/[0.07] p-2.5">
                  <button
                    type="button"
                    className="btn btn-primary h-9 flex-1 text-[11px]"
                    onClick={() => void acceptInvite(invite)}
                    disabled={inviteBusy === invite.tripId}
                  >
                    {inviteBusy === invite.tripId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary h-9 px-4 text-[11px]"
                    onClick={() => void declineInvite(invite)}
                    disabled={inviteBusy === invite.tripId}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
              <div className="rounded-[26px] border border-dashed border-fg/12 px-6 py-8 text-center">
                <p className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
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
