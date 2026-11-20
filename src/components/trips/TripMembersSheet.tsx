import { useEffect, useState } from 'react'
import { Crown, Loader2, LogOut, Mail, RefreshCw, UserPlus, Users } from 'lucide-react'
import type { Trip, TripMembersPayload } from '@/types'
import { ApiError, isNetworkError } from '@/lib/api'
import { api } from '@/lib/api'
import { getErrorMessage, isImeComposing, pluralize } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { useSync } from '@/context/SyncContext'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar } from '@/components/ui/Avatar'

interface TripMembersSheetProps {
  trip: Trip
  onClose: () => void
  onLeft?: () => void
}

export function TripMembersSheet({ trip, onClose, onLeft }: TripMembersSheetProps) {
  const { toast } = useToast()
  const { syncNow } = useSync()
  const [data, setData] = useState<TripMembersPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const load = async (attempt = 0): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const payload = await api.trips.members(trip.id)
      setData(payload)
      setLoading(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404 && attempt < 3) {
        // A just-created trip may not have reached the server yet.
        await syncNow()
        await new Promise((resolve) => setTimeout(resolve, 900))
        return load(attempt + 1)
      }
      setError(cause instanceof ApiError ? cause.message : 'Could not load the people on this trip.')
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])

  const isOwner = data?.me === 'owner' || (!data && trip.role !== 'member')

  const invite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    try {
      await api.trips.invite(trip.id, email.trim())
      setEmail('')
      toast('Invitation sent. It will appear in their Trips page.', 'success', 5000)
      await load()
      void syncNow()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : getErrorMessage(cause))
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setWorkingId(memberId)
    setError(null)
    try {
      await api.trips.removeMember(trip.id, memberId)
      setRemoveConfirm(null)
      toast('Person removed from the trip.', 'success')
      await load()
      void syncNow()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not remove that person.')
    } finally {
      setWorkingId(null)
    }
  }

  const leave = async () => {
    setLeaving(true)
    setError(null)
    try {
      await api.trips.leave(trip.id)
      toast('You left the trip.', 'success')
      onClose()
      onLeft?.()
    } catch (cause) {
      setError(
        isNetworkError(cause)
          ? 'Connect to the internet to leave this trip.'
          : cause instanceof ApiError
            ? cause.message
            : 'Could not leave this trip.',
      )
      setLeaving(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="People on this trip"
      description="Everyone here can see and edit the same itinerary."
      footer={
        !isOwner ? (
          confirmLeave ? (
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-fg">Leave this shared trip?</p>
              <div className="flex gap-2.5">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setConfirmLeave(false)}>
                  Stay
                </button>
                <button
                  type="button"
                  className="btn flex-1 bg-punch text-ink hover:brightness-110"
                  onClick={() => void leave()}
                  disabled={leaving}
                >
                  {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Leave trip
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="btn btn-secondary w-full text-punch"
            >
              <LogOut className="h-4 w-4" />
              Leave this trip
            </button>
          )
        ) : (
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            Done
          </button>
        )
      }
    >
      <div className="space-y-5 pb-1">
        {error ? (
          <p className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-punch">
            {error}
          </p>
        ) : null}

        {isOwner ? (
          <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.025] p-4">
            <p className="field-label">Invite someone</p>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || isImeComposing(event)) return
                    event.preventDefault()
                    void invite()
                  }}
                  placeholder="their@email.com"
                  className="field pl-10 text-sm"
                  disabled={loading && !data}
                  type="email"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary h-11 shrink-0 px-4"
                onClick={() => void invite()}
                disabled={inviting || !email.trim() || (loading && !data)}
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invite
              </button>
            </div>
            <p className="mt-2 text-[10px] font-medium leading-relaxed text-muted/60">
              They need a Jaunt account first. No email is sent — the invitation shows up in their Trips
              page.
            </p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="field-label mb-0">
              <Users className="h-3 w-3" />
              Travelers
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-icon-sm h-7 w-7"
              aria-label="Refresh travelers"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-coral" />
            </div>
          ) : data ? (
            <div className="divide-y divide-fg/[0.06] overflow-hidden rounded-2xl border border-fg/[0.08] bg-fg/[0.025]">
              <div className="flex items-center gap-3 p-3.5">
                <Avatar name={data.owner.displayName} color={data.owner.color} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-fg">
                    {data.owner.displayName}
                    <Crown className="h-3 w-3 text-sun" />
                  </p>
                  <p className="truncate text-[10px] font-bold text-muted">{data.owner.email}</p>
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-sun">Owner</span>
              </div>

              {data.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 p-3.5">
                  <Avatar name={member.displayName} color={member.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-fg">{member.displayName}</p>
                    <p className="truncate text-[10px] font-bold text-muted">{member.email}</p>
                  </div>
                  {member.status === 'pending' ? (
                    <span className="rounded-full bg-sun/10 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-sun">
                      Invited
                    </span>
                  ) : null}
                  {data.me === 'owner' ? (
                    <button
                      type="button"
                      onClick={() =>
                        removeConfirm === member.userId
                          ? void removeMember(member.userId)
                          : setRemoveConfirm(member.userId)
                      }
                      disabled={workingId === member.userId}
                      className={
                        removeConfirm === member.userId
                          ? 'rounded-full bg-punch px-2.5 py-1 text-[9px] font-extrabold text-ink'
                          : 'rounded-full border border-fg/10 px-2.5 py-1 text-[9px] font-extrabold text-muted transition hover:text-fg'
                      }
                    >
                      {workingId === member.userId
                        ? '…'
                        : removeConfirm === member.userId
                          ? 'Confirm'
                          : member.status === 'pending'
                            ? 'Cancel'
                            : 'Remove'}
                    </button>
                  ) : null}
                </div>
              ))}

              {data.members.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs font-medium text-muted">
                    {isOwner
                      ? 'Just you so far. Invite someone to plan together.'
                      : 'Just the owner so far.'}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {data ? (
          <p className="text-center text-[10px] font-medium text-muted/50">
            {pluralize(data.members.filter((member) => member.status === 'accepted').length + 1, 'traveler')}
          </p>
        ) : null}
      </div>
    </Sheet>
  )
}
