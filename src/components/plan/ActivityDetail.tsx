import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Ticket,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db'
import type { Attachment } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import {
  activityDateRangeLabel,
  activityEndDate,
  activityScheduleLabel,
  activitySpanPosition,
  activitySpansMultipleDays,
  dateRangeLabel,
  formatDay,
  todayKey,
} from '@/lib/dates'
import { deleteActivity, setActivityCompleted } from '@/lib/repo'
import { copyText, cssVars, hexAlpha, safeHostname } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'
import { TypeBadge } from '@/components/ui/TypeBadge'
import { AttachmentTile } from '@/components/attachments/AttachmentTile'
import { AttachmentViewer } from '@/components/attachments/AttachmentViewer'
import { PlanWeather } from '@/components/weather/PlanWeather'

interface ActivityDetailProps {
  activityId: string
  onClose: () => void
  onEdit: (activity: import('@/types').Activity) => void
}

export function ActivityDetail({ activityId, onClose, onEdit }: ActivityDetailProps) {
  const activity = useLiveQuery(async () => (await db.activities.get(activityId)) ?? null, [activityId])
  const trip = useLiveQuery(
    async () => {
      if (!activity?.tripId) return undefined
      return db.trips.get(activity.tripId)
    },
    [activity?.tripId],
  )
  const attachments = useLiveQuery(
    () => db.attachments.where('activityId').equals(activityId).toArray(),
    [activityId],
    [] as Attachment[],
  )
  const [viewer, setViewer] = useState<Attachment | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  if (activity === undefined) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()} title="Plan">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-coral" />
        </div>
      </Sheet>
    )
  }

  if (activity === null) {
    return (
      <Sheet
        open
        onOpenChange={(open) => !open && onClose()}
        title="Plan removed"
        footer={
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            Close
          </button>
        }
      >
        <p className="py-6 text-sm font-medium leading-relaxed text-muted">
          This plan was removed, possibly from another device. It is no longer in your itinerary.
        </p>
      </Sheet>
    )
  }

  const meta = activityMeta(activity.type)
  const Icon = meta.icon
  const spanToday = activitySpanPosition(activity, todayKey())
  const spanTotal = activitySpanPosition(activity, activity.date)?.total ?? 1
  const mapsUrl = activity.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`
    : null

  const toggleDone = async () => {
    const next = !activity.completed
    await setActivityCompleted(activity.id, next)
    if (next) toast('Nice — marked as done.', 'success')
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteActivity(activity.id)
      toast('Plan removed.', 'success')
      onClose()
    } catch {
      toast('Could not delete that plan.', 'error')
      setBusy(false)
    }
  }

  const copyConfirmation = async () => {
    if (!activity.confirmation) return
    const copied = await copyText(activity.confirmation)
    toast(copied ? 'Confirmation number copied.' : 'Could not copy the number.', copied ? 'success' : 'error')
  }

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => !open && onClose()}
        wide
        title={activity.name}
        description={
          activitySpansMultipleDays(activity)
            ? dateRangeLabel(activity.date, activityEndDate(activity))
            : formatDay(activity.date, 'EEEE, MMM d')
        }
        footer={
          confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-fg">Delete this plan for good?</p>
              <div className="flex gap-2.5">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn flex-1 bg-punch text-ink hover:brightness-110"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5">
              <button type="button" className="btn btn-primary flex-1" onClick={() => onEdit(activity)}>
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => void toggleDone()}
                aria-label={activity.completed ? 'Mark this plan as not done' : 'Mark this plan as done'}
                className="btn btn-secondary flex-1 px-3"
              >
                {activity.completed ? (
                  <Undo2 className="h-4 w-4 text-muted" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-muted" />
                )}
                {activity.completed ? 'Undo' : 'Done'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn-icon text-muted hover:text-punch"
                aria-label="Delete plan"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        }
      >
        <div className="space-y-5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={activity.type} size="md" />
            {activitySpansMultipleDays(activity) ? (
              <span className="chip bg-violet/15 text-violet">
                {activityDateRangeLabel(activity)}
              </span>
            ) : null}
            {activity.completed ? (
              <span className="chip bg-mint/15 text-mint">
                <Check className="h-3 w-3" /> Done
              </span>
            ) : null}
            {trip ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(`/trips/${trip.id}`)
                }}
                className="trip-color-text chip max-w-full"
                style={{ ...cssVars({ '--trip-color': trip.color }), backgroundColor: hexAlpha(trip.color, 0.14) }}
              >
                <span>{trip.emoji}</span>
                <span className="truncate">{trip.name}</span>
              </button>
            ) : null}
          </div>

          <div
            className="relative overflow-hidden rounded-[24px] border border-fg/10 p-4"
            style={{
              background: `linear-gradient(135deg, ${hexAlpha(meta.color, 0.12)}, var(--color-sheen) 60%)`,
              borderColor: hexAlpha(meta.color, 0.2),
            }}
          >
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ backgroundColor: hexAlpha(meta.color, 0.18) }} />
            <div className="relative flex items-start gap-3.5">
              <span
                className="type-color-text grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fg/10"
                style={{ ...cssVars({ '--type-color': meta.color }), backgroundColor: hexAlpha(meta.color, 0.16) }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug text-fg">
                      {activitySpansMultipleDays(activity)
                        ? dateRangeLabel(activity.date, activityEndDate(activity))
                        : formatDay(activity.date, 'EEEE, MMMM d, yyyy')}
                    </p>
                    {activitySpansMultipleDays(activity) ? (
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-violet">
                        {spanToday ? `Day ${spanToday.day} of ${spanToday.total}` : `${spanTotal} days`}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  <p className="text-[13px] font-bold leading-snug text-fg">
                    {activityScheduleLabel(activity)}
                  </p>
                </div>
                {activity.location ? (
                  mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex break-words items-start gap-2 text-[13px] font-bold leading-snug text-fg underline decoration-white/20 underline-offset-4 transition hover:text-coral"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                      <span>{activity.location}</span>
                    </a>
                  ) : null
                ) : null}
              </div>
            </div>
          </div>

          <PlanWeather activity={activity} trip={trip} />

          {activity.confirmation ? (
            <div className="flex items-center gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-4 py-3">
              <Ticket className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Confirmation</p>
                <p className="truncate font-mono text-sm font-bold tracking-wide text-fg">{activity.confirmation}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyConfirmation()}
                className="btn-icon-sm"
                aria-label="Copy confirmation number"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {activity.url ? (
            <a
              href={activity.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.03] px-4 py-3 transition hover:bg-fg/[0.06]"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-sky" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Link</p>
                <p className="truncate text-sm font-bold text-fg">{safeHostname(activity.url)}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted" />
            </a>
          ) : null}

          {activity.notes ? (
            <div>
              <p className="eyebrow mb-2">Notes</p>
              <p className="whitespace-pre-wrap break-words rounded-2xl border border-fg/[0.07] bg-fg/[0.025] p-4 text-sm font-medium leading-relaxed text-muted">
                {activity.notes}
              </p>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div>
              <p className="eyebrow mb-2">Tickets & photos</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {attachments.map((attachment) => (
                  <AttachmentTile key={attachment.id} attachment={attachment} onOpen={() => setViewer(attachment)} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Sheet>

      <AttachmentViewer attachment={viewer} onClose={() => setViewer(null)} />
    </>
  )
}
