import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Clock, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '@/db'
import type { Activity, Trip } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import { activityScheduleLabel, compactDateRange, formatDay } from '@/lib/dates'
import { useProfile } from '@/context/ProfileContext'
import { useActivityViews } from '@/context/ActivityViews'
import { cssVars, hexAlpha, pluralize } from '@/lib/utils'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matches(values: Array<string | null | undefined>, tokens: string[]): boolean {
  const haystack = normalize(values.filter(Boolean).join(' \n '))
  return tokens.every((token) => haystack.includes(token))
}

function matchedValue(
  values: Array<string | null | undefined>,
  tokens: string[],
): string | null {
  for (const value of values) {
    if (value && matches([value], tokens)) return value
  }
  return null
}

export function SearchPage() {
  const { profile } = useProfile()
  const profileId = profile?.id ?? ''
  const { openDetail } = useActivityViews()
  const [query, setQuery] = useState('')

  const trips = useLiveQuery(
    () =>
      profileId
        ? db.trips.where('profileId').equals(profileId).toArray()
        : Promise.resolve([] as Trip[]),
    [profileId],
    [] as Trip[],
  )

  const activities = useLiveQuery(
    () =>
      profileId
        ? db.activities.where('profileId').equals(profileId).toArray()
        : Promise.resolve([] as Activity[]),
    [profileId],
    [] as Activity[],
  )

  const trimmed = query.trim()
  const tokens = useMemo(
    () => (trimmed.length >= 2 ? normalize(trimmed).split(/\s+/).filter(Boolean) : []),
    [trimmed],
  )

  const tripsById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips])

  const results = useMemo(() => {
    if (tokens.length === 0) return { trips: [] as Trip[], plans: [] as Activity[] }

    const tripMatches = trips
      .filter((trip) => matches([trip.name, trip.destination, trip.notes], tokens))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const planMatches = activities
      .filter((activity) =>
        matches(
          [
            activity.name,
            activity.location,
            activity.confirmation,
            activity.notes,
            activity.url,
          ],
          tokens,
        ),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.sortOrder - b.sortOrder)

    return { trips: tripMatches, plans: planMatches }
  }, [activities, tokens, trips])

  if (!profile) return null

  const total = results.trips.length + results.plans.length

  return (
    <Page>
      <PageHeader
        eyebrow="Find anything"
        title="Search"
        description="Trips, plans, places, confirmation numbers, and notes — all in one place."
        showSearch={false}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          role="searchbox"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search trips, plans, places, confirmations, notes…"
          className="field h-12 pl-11 pr-11 text-base"
          enterKeyHint="search"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {tokens.length === 0 ? (
        <div className="surface mt-6 p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-coral/20 bg-coral/10 text-coral">
            <Search className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-extrabold tracking-[-0.02em] text-fg">
            Find anything in your plans.
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-muted">
            Try a city, a restaurant, a confirmation code, or a phrase from a note. Everything you
            can see in Jaunt is searchable, including shared trips.
          </p>
        </div>
      ) : total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nothing matched."
            description={`No trips or plans include “${trimmed}”. Try a shorter word or a different spelling.`}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Results for “{trimmed}”</p>
            <p className="text-[10px] font-extrabold text-muted/50">{pluralize(total, 'match')}</p>
          </div>

          {results.trips.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">Trips</p>
                <span className="text-[10px] font-extrabold text-muted/50">
                  {results.trips.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {results.trips.map((trip) => {
                  const noteSnippet =
                    trip.notes && matches([trip.notes], tokens) ? trip.notes : null
                  return (
                    <Link
                      key={trip.id}
                      to={`/trips/${trip.id}`}
                      aria-label={`Open trip ${trip.name}`}
                      className="surface flex items-center gap-3 p-3.5 transition hover:bg-fg/[0.05]"
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl"
                        style={{ backgroundColor: hexAlpha(trip.color, 0.2) }}
                      >
                        {trip.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg font-extrabold tracking-[-0.02em] text-fg">
                          {trip.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">
                          {trip.destination ?? 'Trip'} ·{' '}
                          {compactDateRange(trip.startDate, trip.endDate)}
                        </span>
                        {noteSnippet ? (
                          <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-relaxed text-muted/70">
                            {noteSnippet}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}

          {results.plans.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">Plans</p>
                <span className="text-[10px] font-extrabold text-muted/50">
                  {results.plans.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {results.plans.map((activity) => {
                  const meta = activityMeta(activity.type)
                  const Icon = meta.icon
                  const trip = activity.tripId ? tripsById.get(activity.tripId) : null
                  const confirmationMatch = matchedValue([activity.confirmation], tokens)
                  const noteMatch = confirmationMatch
                    ? null
                    : matchedValue([activity.notes], tokens)

                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => openDetail(activity.id)}
                      aria-label={`Open plan ${activity.name}`}
                      className="surface flex w-full items-start gap-3 p-3.5 text-left transition hover:bg-fg/[0.05]"
                    >
                      <span
                        className="type-color-text mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-fg/[0.08]"
                        style={{
                          ...cssVars({ '--type-color': meta.color }),
                          backgroundColor: hexAlpha(meta.color, 0.14),
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="break-words font-display text-base font-extrabold leading-tight tracking-[-0.02em] text-fg">
                            {activity.name}
                          </span>
                          <span className="chip shrink-0 text-[9px]">
                            {formatDay(activity.date, 'MMM d')}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted">
                          {trip ? `${trip.emoji} ${trip.name}` : 'Loose plan'}
                          {activity.location ? ` · ${activity.location}` : ''}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-muted/60">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activityScheduleLabel(activity)}
                          </span>
                          {activity.completed ? <span className="text-mint">Done</span> : null}
                        </span>
                        {confirmationMatch ? (
                          <span className="mt-1 block text-[11px] font-bold text-sun">
                            Confirmation {confirmationMatch}
                          </span>
                        ) : null}
                        {noteMatch ? (
                          <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-relaxed text-muted/70">
                            {noteMatch}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Page>
  )
}
