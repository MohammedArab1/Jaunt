import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  StickyNote,
  Ticket,
  X,
} from 'lucide-react'
import { db } from '@/db'
import type { Activity, ActivityDefaults, ActivityType, Attachment, Trip } from '@/types'
import { ACTIVITY_TYPE_ORDER, activityMeta } from '@/lib/activityMeta'
import { compactDateRange, todayKey } from '@/lib/dates'
import { newId } from '@/lib/id'
import { ATTACHMENT_ACCEPT, prepareAttachment } from '@/lib/images'
import { createActivity, deleteAttachment, saveAttachment, updateActivity } from '@/lib/repo'
import { cn, formatBytes, getErrorMessage, hexAlpha, normalizeUrl } from '@/lib/utils'
import { useProfile } from '@/context/ProfileContext'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'
import { Field } from '@/components/ui/Field'
import { AttachmentTile } from '@/components/attachments/AttachmentTile'

interface StagedFile {
  key: string
  blob: Blob
  name: string
  mimeType: string
  size: number
  previewUrl?: string
}

interface ActivityEditorProps {
  activity?: Activity
  defaults?: ActivityDefaults
  onClose: () => void
}

export function ActivityEditor({ activity, defaults, onClose }: ActivityEditorProps) {
  const { profile } = useProfile()
  const profileId = profile?.id ?? ''
  const { toast } = useToast()

  const [name, setName] = useState(activity?.name ?? '')
  const [type, setType] = useState<ActivityType>(activity?.type ?? defaults?.type ?? 'experience')
  const [date, setDate] = useState(activity?.date ?? defaults?.date ?? todayKey())
  const [startTime, setStartTime] = useState(activity?.startTime ?? defaults?.startTime ?? '')
  const [endTime, setEndTime] = useState(activity?.endTime ?? '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [tripId, setTripId] = useState(activity?.tripId ?? defaults?.tripId ?? '')
  const [confirmation, setConfirmation] = useState(activity?.confirmation ?? '')
  const [url, setUrl] = useState(activity?.url ?? '')
  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stagedRef = useRef<StagedFile[]>([])

  useEffect(() => {
    stagedRef.current = staged
  }, [staged])

  useEffect(() => {
    return () => {
      for (const file of stagedRef.current) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
      }
    }
  }, [])

  const trips = useLiveQuery(
    async () => {
      if (!profileId) return []
      const rows = await db.trips.where('profileId').equals(profileId).toArray()
      return rows.sort((a, b) => a.startDate.localeCompare(b.startDate))
    },
    [profileId],
    [] as Trip[],
  )

  const existingAttachments = useLiveQuery(
    async () => {
      if (!activity) return []
      return db.attachments.where('activityId').equals(activity.id).toArray()
    },
    [activity?.id],
    [] as Attachment[],
  )

  const selectedTrip = trips.find((trip) => trip.id === tripId)
  const tripDateError =
    selectedTrip && (date < selectedTrip.startDate || date > selectedTrip.endDate)
      ? `This date sits outside ${selectedTrip.name} (${compactDateRange(selectedTrip.startDate, selectedTrip.endDate)}).`
      : null

  const visibleAttachments = existingAttachments.filter((attachment) => !removedIds.includes(attachment.id))
  const attachmentCount = visibleAttachments.length + staged.length

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const accepted: StagedFile[] = []

    for (const file of Array.from(files)) {
      if (attachmentCount + accepted.length >= 12) {
        toast('Up to 12 files per plan.', 'error')
        break
      }
      try {
        const prepared = await prepareAttachment(file)
        accepted.push({
          key: newId(),
          blob: prepared.blob,
          name: prepared.name,
          mimeType: prepared.mimeType,
          size: prepared.blob.size,
          previewUrl: prepared.mimeType.startsWith('image/') ? URL.createObjectURL(prepared.blob) : undefined,
        })
      } catch (cause) {
        toast(getErrorMessage(cause), 'error', 5000)
      }
    }

    setStaged((current) => [...current, ...accepted])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeStaged = (file: StagedFile) => {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
    setStaged((current) => current.filter((item) => item.key !== file.key))
  }

  const save = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Give this plan a name.')
      return
    }
    if (!date) {
      setError('Pick a date for this plan.')
      return
    }
    if (endTime && !startTime) {
      setError('Add a start time before an end time.')
      return
    }
    if (startTime && endTime && endTime <= startTime) {
      setError('End time needs to be later than the start time.')
      return
    }
    if (tripDateError) {
      setError(tripDateError)
      return
    }

    const normalizedUrl = url.trim() ? normalizeUrl(url) : {}
    if (normalizedUrl.error) {
      setError(normalizedUrl.error)
      return
    }

    setBusy(true)
    const now = Date.now()
    const record: Activity = {
      id: activity?.id ?? newId(),
      profileId: activity?.profileId ?? profile?.id ?? '',
      tripId: selectedTrip?.id,
      name: name.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      type,
      notes: notes.trim() || undefined,
      confirmation: confirmation.trim() || undefined,
      url: normalizedUrl.url,
      completed: activity?.completed ?? false,
      sortOrder: activity?.sortOrder ?? 0,
      createdAt: activity?.createdAt ?? now,
      updatedAt: now,
    }

    try {
      if (activity) await updateActivity(record)
      else await createActivity(record)

      for (const id of removedIds) {
        await deleteAttachment(id)
      }

      for (const file of staged) {
        await saveAttachment({
          activityId: record.id,
          profileId: record.profileId,
          blob: file.blob,
          name: file.name,
          mimeType: file.mimeType,
        })
      }

      toast(activity ? 'Plan updated.' : 'Plan added to your day.', 'success')
      onClose()
    } catch (cause) {
      setError(getErrorMessage(cause))
      setBusy(false)
    }
  }

  if (!profile) return null

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      full
      wide
      title={activity ? 'Edit plan' : 'New plan'}
      description={activity ? 'Tweak the details and keep moving.' : 'A little detail goes a long way.'}
      footer={
        <>
          {error ? (
            <p className="mb-3 rounded-xl border border-punch/20 bg-punch/10 px-3 py-2 text-xs font-bold text-[#FFB3C5]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2.5">
            <button type="button" className="btn btn-secondary px-6" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => void save()} disabled={busy || uploading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Saving…' : activity ? 'Save changes' : 'Add plan'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-6 pb-1">
        <Field label="What is it?" htmlFor="activity-name">
          <input
            id="activity-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunset sail, dinner at Nopa, flight to Lisbon…"
            className="field text-base font-bold"
            maxLength={120}
          />
        </Field>

        <div>
          <p className="field-label">Type</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Plan type">
            {ACTIVITY_TYPE_ORDER.map((value) => {
              const meta = activityMeta(value)
              const Icon = meta.icon
              const selected = type === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(value)}
                  className={cn(
                    'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[9px] font-extrabold uppercase tracking-[0.05em] transition-all',
                    selected
                      ? 'text-cream'
                      : 'border-white/[0.07] bg-white/[0.03] text-muted hover:border-white/15 hover:bg-white/[0.05]',
                  )}
                  style={
                    selected
                      ? {
                          borderColor: hexAlpha(meta.color, 0.65),
                          backgroundColor: hexAlpha(meta.color, 0.14),
                          color: meta.color,
                        }
                      : undefined
                  }
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={selected ? 2.4 : 2} />
                  <span className="truncate">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="activity-date" className="col-span-2">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="activity-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="field pl-10"
                required
              />
            </div>
          </Field>
          <Field label="Starts" htmlFor="activity-start">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="activity-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="field pl-10"
              />
            </div>
          </Field>
          <Field label="Ends" htmlFor="activity-end" hint={!startTime ? 'Leave both empty for any time.' : undefined}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="activity-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="field pl-10"
              />
            </div>
          </Field>
        </div>

        <Field label="Where" htmlFor="activity-location">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="activity-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Venue, address, or meeting point"
              className="field pl-10"
              maxLength={180}
            />
          </div>
        </Field>

        <Field label="Part of a trip?" htmlFor="activity-trip">
          <div className="relative">
            <select
              id="activity-trip"
              value={selectedTrip?.id ?? ''}
              onChange={(event) => setTripId(event.target.value)}
              className="field appearance-none pr-10"
            >
              <option value="">No trip — a loose plan</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.emoji} {trip.name} · {compactDateRange(trip.startDate, trip.endDate)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
          {tripDateError ? (
            <p className="mt-1.5 text-xs font-semibold text-[#FF9DB6]">{tripDateError}</p>
          ) : selectedTrip ? (
            <p className="mt-1.5 text-xs font-medium text-muted/70">
              {selectedTrip.emoji} {compactDateRange(selectedTrip.startDate, selectedTrip.endDate)}
            </p>
          ) : null}
        </Field>

        <div className="space-y-4 rounded-[24px] border border-white/[0.07] bg-white/[0.022] p-4">
          <p className="eyebrow">Booking details</p>

          <Field label="Confirmation number" htmlFor="activity-confirmation" icon={<Ticket className="h-3 w-3" />}>
            <input
              id="activity-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="ABC123"
              className="field font-mono uppercase tracking-wide"
              maxLength={80}
            />
          </Field>

          <Field label="Link" htmlFor="activity-url" icon={<Link2 className="h-3 w-3" />}>
            <input
              id="activity-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              className="field"
              maxLength={500}
            />
          </Field>

          <Field label="Notes" htmlFor="activity-notes" icon={<StickyNote className="h-3 w-3" />}>
            <textarea
              id="activity-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Gate, dress code, who you're meeting, the little things…"
              className="field min-h-[96px] resize-y leading-relaxed"
              maxLength={2000}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="field-label mb-0">
              <Paperclip className="h-3 w-3" />
              Tickets & photos
            </p>
            <span className="text-[10px] font-bold text-muted/60">{attachmentCount}/12</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {visibleAttachments.map((attachment) => (
              <AttachmentTile
                key={attachment.id}
                attachment={attachment}
                onRemove={() => setRemovedIds((current) => [...current, attachment.id])}
              />
            ))}

            {staged.map((file) => (
              <div
                key={file.key}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
              >
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#1B1721] p-2 text-center">
                    <FileText className="h-6 w-6 text-coral" />
                    <span className="line-clamp-2 text-[9px] font-bold leading-tight text-muted">{file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeStaged(file)}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-cream backdrop-blur transition hover:bg-black"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {attachmentCount < 12 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-muted transition hover:border-coral/40 hover:bg-coral/[0.05] hover:text-coral disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
                <span className="text-[9px] font-extrabold uppercase tracking-[0.08em]">
                  {uploading ? 'Adding…' : 'Add'}
                </span>
              </button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => void addFiles(event.target.files)}
          />

          <p className="mt-2 text-[11px] font-medium leading-relaxed text-muted/60">
            Photos or PDFs, up to 25 MB each. They stay on this device.
          </p>
          {staged.length > 0 ? (
            <p className="mt-1 text-[10px] font-bold text-muted/45">
              {formatBytes(staged.reduce((total, file) => total + file.size, 0))} of new files ready to save
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  )
}
