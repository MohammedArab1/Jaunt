import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CloudSun, Eye, EyeOff, Loader2, Luggage, Pencil, Plus, Sparkles } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '@/db'
import type { PackingCategory, PackingItem, TripTraveler } from '@/types'
import { PACKING_CATEGORIES, packingCategoryRank } from '@/lib/packing'
import { createPackingItem, seedPackingEssentials, setPackingItemPacked } from '@/lib/repo'
import { buildPackingSuggestions, type PackingSuggestion } from '@/lib/packingSuggestions'
import { cn, getErrorMessage, hexAlpha, pluralize } from '@/lib/utils'
import { useTripWeather } from '@/hooks/useTripWeather'
import { useProfile } from '@/context/ProfileContext'
import { useToast } from '@/context/ToastContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { PACKING_ICONS, PACKING_TONES } from '@/components/packing/packingMeta'
import { PackingItemSheet } from '@/components/packing/PackingItemSheet'

function PackingRow({
  item,
  readOnly = false,
  onToggle,
  onEdit,
}: {
  item: PackingItem
  readOnly?: boolean
  onToggle?: (item: PackingItem) => void
  onEdit?: (item: PackingItem) => void
}) {
  const checkboxClass = cn(
    'grid h-6 w-6 shrink-0 place-items-center rounded-full border transition',
    item.packed ? 'border-mint bg-mint text-ink' : 'border-fg/20 text-transparent',
  )
  const content = (
    <span className="min-w-0 flex-1">
      <span
        className={cn(
          'block break-words text-sm font-extrabold leading-snug',
          item.packed ? 'text-muted line-through' : 'text-fg',
        )}
      >
        {item.name}
      </span>
      {item.quantity > 1 || item.packed ? (
        <span className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-muted/60">
          {item.quantity > 1 ? <span>×{item.quantity}</span> : null}
          {item.packed ? <span className="text-mint">Packed</span> : null}
        </span>
      ) : null}
    </span>
  )

  return (
    <div className="flex items-center gap-1.5 p-2.5 pl-3.5">
      {readOnly ? (
        <span className={checkboxClass} aria-hidden>
          {item.packed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onToggle?.(item)}
          aria-label={item.packed ? `Mark ${item.name} as not packed` : `Mark ${item.name} as packed`}
          aria-pressed={item.packed}
          className={cn(checkboxClass, !item.packed && 'hover:border-fg/40')}
        >
          {item.packed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </button>
      )}

      {readOnly ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1">{content}</div>
      ) : (
        <button
          type="button"
          onClick={() => onEdit?.(item)}
          aria-label={`Edit ${item.name}`}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          {content}
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted/40" />
        </button>
      )}
    </div>
  )
}

export function PackingListPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const { profile } = useProfile()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState<PackingCategory>('other')
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [suggestionBusy, setSuggestionBusy] = useState(false)
  const [hidePacked, setHidePacked] = useState(false)
  const [editing, setEditing] = useState<PackingItem | null>(null)

  const trip = useLiveQuery(async () => {
    if (!tripId) return null
    return (await db.trips.get(tripId)) ?? null
  }, [tripId])

  const items = useLiveQuery(
    () =>
      tripId
        ? db.packingItems.where('tripId').equals(tripId).toArray()
        : Promise.resolve([] as PackingItem[]),
    [tripId],
    [] as PackingItem[],
  )

  const weather = useTripWeather(trip)
  const weatherSuggestions = useMemo(
    () => buildPackingSuggestions(weather.locations),
    [weather.locations],
  )

  const sorted = useMemo(
    () =>
      items.toSorted(
        (a, b) =>
          packingCategoryRank(a.category) - packingCategoryRank(b.category) ||
          a.sortOrder - b.sortOrder ||
          a.createdAt - b.createdAt,
      ),
    [items],
  )

  const travelers = useMemo(() => {
    const byId = new Map<string, TripTraveler>()

    for (const traveler of trip?.travelers ?? []) {
      byId.set(traveler.id, traveler)
    }

    if (profile && !byId.has(profile.id)) {
      byId.set(profile.id, {
        id: profile.id,
        displayName: profile.name,
        color: profile.color,
        role: trip?.role ?? 'owner',
      })
    }

    for (const item of items) {
      if (!byId.has(item.ownerUserId)) {
        byId.set(item.ownerUserId, {
          id: item.ownerUserId,
          displayName: item.ownerUserId === profile?.id ? (profile?.name ?? 'You') : 'Traveler',
          color: '#A79FB6',
          role: 'member',
        })
      }
    }

    return [...byId.values()].sort((a, b) => {
      if (a.id === profile?.id) return -1
      if (b.id === profile?.id) return 1
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
      return a.displayName.localeCompare(b.displayName)
    })
  }, [items, profile, trip])

  const requestedTravelerId = searchParams.get('traveler')
  const selectedTravelerId =
    requestedTravelerId && travelers.some((traveler) => traveler.id === requestedTravelerId)
      ? requestedTravelerId
      : (profile?.id ?? '')

  const selectedSorted = useMemo(
    () => sorted.filter((item) => item.ownerUserId === selectedTravelerId),
    [selectedTravelerId, sorted],
  )

  const groups = useMemo(
    () =>
      PACKING_CATEGORIES.map((option) => {
        const all = selectedSorted.filter((item) => item.category === option.value)
        const visible = hidePacked ? all.filter((item) => !item.packed) : all
        return {
          ...option,
          items: visible,
          total: all.length,
          done: all.filter((item) => item.packed).length,
        }
      }).filter((group) => group.items.length > 0),
    [hidePacked, selectedSorted],
  )

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
          showSearch={false}
        />
        <EmptyState
          icon={<Luggage className="h-6 w-6" />}
          title="Nothing to pack."
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

  const selectedTraveler =
    travelers.find((traveler) => traveler.id === selectedTravelerId) ?? travelers[0]
  if (!selectedTraveler) return null

  const isOwn = selectedTraveler.id === profile.id
  const total = selectedSorted.length
  const done = selectedSorted.filter((item) => item.packed).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const allPacked = total > 0 && done === total
  const SelectedIcon = PACKING_ICONS[category]
  const someHidden = hidePacked && total > 0 && groups.length === 0
  const availableSuggestions = isOwn
    ? weatherSuggestions.filter(
        (suggestion) =>
          !selectedSorted.some(
            (item) => item.name.trim().toLowerCase() === suggestion.name.trim().toLowerCase(),
          ),
      )
    : []
  const suggestionNote = [...new Set(availableSuggestions.map((item) => item.reason))]
    .slice(0, 2)
    .join(' · ')

  const selectTraveler = (travelerId: string) => {
    const next = new URLSearchParams(searchParams)
    if (travelerId === profile.id) next.delete('traveler')
    else next.set('traveler', travelerId)
    setSearchParams(next, { replace: true })
  }

  const addItem = async () => {
    const value = name.trim()
    if (!value) return

    setAdding(true)
    try {
      await createPackingItem({
        profileId: profile.id,
        tripId: trip.id,
        ownerUserId: profile.id,
        name: value,
        category,
      })
      setName('')
      inputRef.current?.focus()
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setAdding(false)
    }
  }

  const addEssentials = async () => {
    setSeeding(true)
    try {
      const count = await seedPackingEssentials(profile.id, trip.id, profile.id)
      if (count > 0) {
        toast(`Added ${pluralize(count, 'starter item')}.`, 'success')
      }
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setSeeding(false)
    }
  }

  const addSuggestion = async (suggestion: PackingSuggestion) => {
    setSuggestionBusy(true)
    try {
      await createPackingItem({
        profileId: profile.id,
        tripId: trip.id,
        ownerUserId: profile.id,
        name: suggestion.name,
        category: suggestion.category,
      })
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setSuggestionBusy(false)
    }
  }

  const addAllSuggestions = async () => {
    if (availableSuggestions.length === 0) return
    setSuggestionBusy(true)
    try {
      for (const suggestion of availableSuggestions) {
        await createPackingItem({
          profileId: profile.id,
          tripId: trip.id,
          ownerUserId: profile.id,
          name: suggestion.name,
          category: suggestion.category,
        })
      }
      toast(`Added ${pluralize(availableSuggestions.length, 'suggestion')}.`, 'success')
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setSuggestionBusy(false)
    }
  }

  const toggleItem = async (item: PackingItem) => {
    try {
      await setPackingItemPacked(item.id, !item.packed)
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow={trip.name}
        title="Packing"
        description={
          isOwn
            ? 'Everything that needs to make it into the bag.'
            : `${selectedTraveler.displayName}'s packing list — read-only.`
        }
        onBack={() => navigate(`/trips/${trip.id}`)}
        backLabel="Back to trip"
        showSearch={false}
      />

      {travelers.length > 1 ? (
        <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {travelers.map((traveler) => {
            const active = traveler.id === selectedTraveler.id
            return (
              <button
                key={traveler.id}
                type="button"
                onClick={() => selectTraveler(traveler.id)}
                aria-pressed={active}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-left transition',
                  active
                    ? 'border-fg/25 bg-fg/10 text-fg'
                    : 'border-fg/10 bg-fg/[0.03] text-muted hover:border-fg/20 hover:bg-fg/[0.06] hover:text-fg',
                )}
              >
                <Avatar name={traveler.displayName} color={traveler.color} size="sm" />
                <span className="max-w-[9rem] truncate text-xs font-extrabold">
                  {traveler.id === profile.id ? 'You' : traveler.displayName}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {!isOwn ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-sky/20 bg-sky/[0.08] p-3.5">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
          <div>
            <p className="text-xs font-extrabold text-fg">
              Viewing {selectedTraveler.displayName}'s list
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-muted">
              Only {selectedTraveler.displayName} can add or check off items.
            </p>
          </div>
        </div>
      ) : null}

      <section
        className="relative overflow-hidden rounded-[30px] border p-5"
        style={{
          borderColor: hexAlpha(trip.color, 0.26),
          background: `radial-gradient(130% 150% at 0% 0%, ${hexAlpha(trip.color, 0.32)}, transparent 58%), linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))`,
        }}
      >
        <div className="flex items-center gap-4">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-fg/15"
            style={{ backgroundColor: hexAlpha(trip.color, 0.2), color: trip.color }}
          >
            <Luggage className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Packed</p>
            <p className="mt-1 font-display text-3xl font-extrabold leading-none tracking-[-0.04em] text-fg">
              {done}
              <span className="text-lg text-muted"> of {total}</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted">
              {total === 0
                ? 'Nothing on the list yet.'
                : allPacked
                  ? isOwn
                    ? 'Everything is packed. Go have fun.'
                    : `${selectedTraveler.displayName}'s list is all packed.`
                  : `${percent}% ready to go.`}
              {allPacked ? <Sparkles className="h-3 w-3 text-mint" /> : null}
            </p>
          </div>
          {total > 0 ? (
            <span className="hidden shrink-0 rounded-full border border-fg/10 bg-fg/[0.05] px-2.5 py-1 text-[10px] font-extrabold text-fg sm:inline">
              {percent}%
            </span>
          ) : null}
        </div>

        {total > 0 ? (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-fg/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, backgroundColor: trip.color }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setHidePacked((value) => !value)}
                aria-pressed={hidePacked}
                className="inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[10px] font-extrabold text-muted transition hover:text-fg"
              >
                {hidePacked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {hidePacked ? 'Show packed' : 'Hide packed'}
              </button>
              <span className="text-[10px] font-extrabold text-muted/60">
                {done === total ? 'All done' : `${pluralize(total - done, 'item')} left`}
              </span>
            </div>
          </>
        ) : null}
      </section>

      {isOwn && availableSuggestions.length > 0 ? (
        <section className="mt-5 rounded-[24px] border border-sky/20 bg-sky/[0.06] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky/20 bg-sky/10 text-sky">
              <CloudSun className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="eyebrow text-sky/80">Weather suggests</p>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-muted">
                    {suggestionNote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void addAllSuggestions()}
                  disabled={suggestionBusy}
                  className="btn btn-secondary h-8 shrink-0 px-3 text-[9px]"
                >
                  {suggestionBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Add all
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {availableSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    onClick={() => void addSuggestion(suggestion)}
                    disabled={suggestionBusy}
                    title={suggestion.reason}
                    className="inline-flex items-center gap-1 rounded-full border border-sky/20 bg-sky/10 px-2.5 py-1 text-[10px] font-extrabold text-sky transition hover:bg-sky/15 disabled:opacity-50"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {suggestion.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isOwn ? (
        <section className="mt-6 rounded-[26px] border border-fg/[0.08] bg-fg/[0.025] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="field-label mb-0">Add an item</p>
              <p className="mt-1 text-[11px] font-semibold text-muted/70">
                Pick a category, then type what goes in the bag.
              </p>
            </div>
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                PACKING_TONES[category],
              )}
            >
              <SelectedIcon className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PACKING_CATEGORIES.map((option) => {
              const active = category === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  aria-pressed={active}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-extrabold transition',
                    active
                      ? PACKING_TONES[option.value]
                      : 'border-fg/10 bg-fg/[0.03] text-muted hover:border-fg/20 hover:bg-fg/[0.06]',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void addItem()
            }}
          >
            <input
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Packing item"
              placeholder="Passport, charger, sunscreen…"
              className="field h-11 min-w-0 flex-1 text-sm"
              maxLength={200}
              autoComplete="off"
              enterKeyHint="done"
            />
            <button
              type="submit"
              className="btn btn-primary h-11 shrink-0 px-4 text-xs"
              disabled={adding || !name.trim()}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </form>
        </section>
      ) : null}

      {total === 0 ? (
        isOwn ? (
          <div className="mt-6">
            <EmptyState
              icon={<Luggage className="h-6 w-6" />}
              title="Nothing in the bag yet."
              description="Add your first item above, or start with a checklist of the travel essentials."
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void addEssentials()}
                  disabled={seeding}
                >
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {seeding ? 'Adding…' : 'Add essentials'}
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Luggage className="h-6 w-6" />}
              title={`${selectedTraveler.displayName}'s list is empty.`}
              description={`Only ${selectedTraveler.displayName} can add items to this list.`}
            />
          </div>
        )
      ) : someHidden ? (
        <div className="mt-6 rounded-[26px] border border-fg/[0.08] bg-fg/[0.025] p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-mint/20 bg-mint/10 text-mint">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <h2 className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-fg">
            Everything is packed.
          </h2>
          <p className="mt-1 text-xs font-medium text-muted">
            {pluralize(done, 'item')} checked off. Show the packed items to make changes.
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => setHidePacked(false)}
          >
            <Eye className="h-4 w-4" />
            Show packed items
          </button>
        </div>
      ) : (
        <div className="mt-7 space-y-6">
          {groups.map((group) => {
            const Icon = PACKING_ICONS[group.value]
            return (
              <section key={group.value}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-xl border',
                        PACKING_TONES[group.value],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
                      {group.label}
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold text-muted/60">
                    {group.done}/{group.total}
                  </span>
                </div>

                <div className="divide-y divide-fg/[0.06] overflow-hidden rounded-[24px] border border-fg/[0.08] bg-fg/[0.025]">
                  {group.items.map((item) => (
                    <PackingRow
                      key={item.id}
                      item={item}
                      readOnly={!isOwn}
                      onToggle={(next) => void toggleItem(next)}
                      onEdit={setEditing}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {isOwn && editing ? (
        <PackingItemSheet
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Page>
  )
}
