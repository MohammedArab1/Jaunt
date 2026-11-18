import type { Trip, TripDestination } from '@/types'

function legacyId(name: string): string {
  return `legacy:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function tripDestinations(trip: Trip): TripDestination[] {
  if (trip.destinations?.length) return trip.destinations
  if (!trip.destination) return []
  return trip.destination
    .split(' · ')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: legacyId(name), name }))
}
