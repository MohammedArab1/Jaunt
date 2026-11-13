import { useState } from 'react'
import { Loader2, StickyNote } from 'lucide-react'
import { addDays } from 'date-fns'
import type { Trip } from '@/types'
import { dateKey, dateRangeLabel, formatDay, todayKey } from '@/lib/dates'
import { TRIP_COLORS, TRIP_EMOJIS } from '@/lib/palette'
import { createTrip, updateTrip } from '@/lib/repo'
import { cn, getErrorMessage, hexAlpha } from '@/lib/utils'
import { useProfile } from '@/context/ProfileContext'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'
import { Field } from '@/components/ui/Field'
import { DateInput } from '@/components/ui/DateInput'
import { DestinationCombobox } from '@/components/trips/DestinationCombobox'

interface TripFormProps {
  trip?: Trip
  onClose: () => void
  onSaved?: (trip: Trip) => void
}

export function TripForm({ trip, onClose, onSaved }: TripFormProps) {
  const { profile } = useProfile()
  const { toast } = useToast()
  const [name, setName] = useState(trip?.name ?? '')
  const [destinations, setDestinations] = useState<string[]>(() =>
    trip?.destination
      ? trip.destination
          .split(' · ')
          .map((city) => city.trim())
          .filter(Boolean)
      : [],
  )
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayKey())
  const [endDate, setEndDate] = useState(trip?.endDate ?? dateKey(addDays(new Date(), 2)))
  const [color, setColor] = useState(trip?.color ?? TRIP_COLORS[0])
  const [emoji, setEmoji] = useState(trip?.emoji ?? TRIP_EMOJIS[0])
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const updateStart = (value: string) => {
    setStartDate(value)
    if (value && value > endDate) setEndDate(value)
  }

  const save = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Give this trip a name.')
      return
    }
    if (!startDate || !endDate) {
      setError('Pick a start and end date.')
      return
    }
    if (endDate < startDate) {
      setError('The end date needs to come after the start date.')
      return
    }
    if (!profile) return

    const destination = destinations.join(' · ')
    if (destination.length > 300) {
      setError('Keep the destination under 300 characters.')
      return
    }

    setBusy(true)
    try {
      const fields = {
        name: name.trim(),
        destination: destination || undefined,
        startDate,
        endDate,
        color,
        emoji,
        notes: notes.trim() || undefined,
      }

      if (trip) {
        await updateTrip({ ...trip, ...fields })
        toast('Trip updated.', 'success')
        onClose()
      } else {
        const created = await createTrip({ profileId: profile.id, ...fields })
        toast('Trip created. Time to fill the days.', 'success')
        onClose()
        onSaved?.(created)
      }
    } catch (cause) {
      setError(getErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      full
      wide
      title={trip ? 'Edit trip' : 'New trip'}
      description={trip ? 'Change the shape of the adventure.' : 'Where are we going, and when?'}
      footer={
        <>
          {error ? (
            <p className="mb-3 rounded-xl border border-punch/20 bg-punch/10 px-3 py-2 text-xs font-bold text-punch" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2.5">
            <button type="button" className="btn btn-secondary px-6" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Saving…' : trip ? 'Save trip' : 'Create trip'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-6 pb-1">
        <div
          className="relative flex items-center gap-4 overflow-hidden rounded-[24px] border p-4"
          style={{
            borderColor: hexAlpha(color, 0.25),
            background: `linear-gradient(135deg, ${hexAlpha(color, 0.18)}, var(--color-sheen) 65%)`,
          }}
        >
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[28px] shadow-inner"
            style={{ backgroundColor: hexAlpha(color, 0.2) }}
          >
            {emoji}
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Trip preview</p>
            <p className="truncate font-display text-xl font-extrabold tracking-[-0.02em] text-fg">
              {name.trim() || 'Your next adventure'}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-muted">
              {startDate && endDate ? dateRangeLabel(startDate, endDate) : 'Pick your dates'}
            </p>
          </div>
        </div>

        <Field label="Trip name" htmlFor="trip-name">
          <input
            id="trip-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Lisbon long weekend, The big 3-0, Cabin escape…"
            className="field font-bold"
            maxLength={80}
          />
        </Field>

        <Field label="Destination" htmlFor="trip-destination">
          <DestinationCombobox
            id="trip-destination"
            value={destinations}
            onChange={setDestinations}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="trip-start">
            <DateInput id="trip-start" value={startDate} onChange={updateStart} />
          </Field>
          <Field label="Ends" htmlFor="trip-end">
            <DateInput
              id="trip-end"
              value={endDate}
              min={startDate}
              onChange={setEndDate}
            />
          </Field>
        </div>
        {startDate && endDate && endDate >= startDate ? (
          <p className="-mt-3 text-[11px] font-bold text-muted/60">
            {formatDay(startDate, 'EEE, MMM d')} → {formatDay(endDate, 'EEE, MMM d')}
          </p>
        ) : null}

        <div>
          <p className="field-label">Color</p>
          <div className="grid grid-cols-8 gap-2">
            {TRIP_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`Use color ${option}`}
                aria-pressed={color === option}
                className="aspect-square w-full rounded-full transition-transform hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: option,
                  boxShadow: color === option ? `0 0 0 3px var(--color-page), 0 0 0 5px ${option}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="field-label">Cover emoji</p>
          <div className="grid grid-cols-8 gap-1.5">
            {TRIP_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                aria-pressed={emoji === option}
                className={cn(
                  'grid aspect-square place-items-center rounded-xl border text-lg transition',
                  emoji === option
                    ? 'border-fg/25 bg-fg/[0.12]'
                    : 'border-transparent bg-fg/[0.03] hover:bg-fg/[0.07]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <Field label="Trip notes" htmlFor="trip-notes" icon={<StickyNote className="h-3 w-3" />}>
          <textarea
            id="trip-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="The plan behind the plan — who's coming, what you're celebrating…"
            className="field min-h-[90px] resize-y leading-relaxed"
            maxLength={2000}
          />
        </Field>
      </div>
    </Sheet>
  )
}
