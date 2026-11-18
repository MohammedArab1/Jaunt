export type TimeSlot = 'early-morning' | 'morning' | 'afternoon' | 'evening'

export type ActivityType =
  | 'flight'
  | 'lodging'
  | 'food'
  | 'experience'
  | 'transport'
  | 'event'
  | 'shopping'
  | 'other'

export type PackingCategory =
  | 'documents'
  | 'clothing'
  | 'toiletries'
  | 'electronics'
  | 'gear'
  | 'other'

export interface Profile {
  id: string
  name: string
  color: string
  createdAt: number
  kind?: 'guest' | 'account'
}

export interface TripTraveler {
  id: string
  displayName: string
  color: string
  role: 'owner' | 'member'
}

export interface TripDestination {
  id: string
  name: string
  country?: string
  admin1?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

export interface Trip {
  id: string
  profileId: string
  name: string
  destination?: string
  destinations?: TripDestination[]
  startDate: string
  endDate: string
  color: string
  emoji: string
  notes?: string
  role?: 'owner' | 'member'
  memberCount?: number
  travelers?: TripTraveler[]
  createdAt: number
  updatedAt: number
  dirty?: boolean
}

export interface Activity {
  id: string
  profileId: string
  tripId?: string
  destinationId?: string
  name: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  timeSlot?: TimeSlot
  location?: string
  type: ActivityType
  notes?: string
  confirmation?: string
  url?: string
  completed: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
  dirty?: boolean
}

export interface PackingItem {
  id: string
  profileId: string
  tripId: string
  ownerUserId: string
  name: string
  category: PackingCategory
  quantity: number
  packed: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
  dirty?: boolean
}

export interface Attachment {
  id: string
  activityId: string
  profileId: string
  name: string
  mimeType: string
  size: number
  createdAt: number
  updatedAt: number
  dirty?: boolean
  pendingUpload?: boolean
}

export interface FileRecord {
  id: string
  blob: Blob
}

export interface PendingDeletion {
  id?: number
  profileId: string
  entity: 'trip' | 'activity' | 'attachment' | 'packing'
  entityId: string
  deletedAt: number
}

export interface SyncState {
  key: string
  lastRevision: number
  lastSyncedAt: number
}

export interface BackupFile extends Attachment {
  data: string
}

export interface Backup {
  format: 'jaunt-backup'
  version: 1
  exportedAt: string
  profiles: Profile[]
  trips: Trip[]
  activities: Activity[]
  packingItems?: PackingItem[]
  attachments: BackupFile[]
}

export interface ActivityDefaults {
  date?: string
  tripId?: string
  startTime?: string
  type?: ActivityType
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  color: string
}

export interface SyncTrip {
  id: string
  name: string
  destination?: string | null
  destinations?: TripDestination[] | null
  startDate: string
  endDate: string
  color: string
  emoji: string
  notes?: string | null
  role?: 'owner' | 'member'
  memberCount?: number
  createdAt: number
  updatedAt: number
}

export interface SyncActivity {
  id: string
  tripId?: string | null
  destinationId?: string | null
  name: string
  date: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  timeSlot?: TimeSlot | null
  location?: string | null
  type: ActivityType
  notes?: string | null
  confirmation?: string | null
  url?: string | null
  completed: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface SyncTraveler extends TripTraveler {
  tripId: string
}

export interface SyncPackingItem {
  id: string
  tripId: string
  ownerUserId: string
  name: string
  category: PackingCategory
  quantity: number
  packed: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface SyncAttachment {
  id: string
  activityId: string
  name: string
  mimeType: string
  size: number
  createdAt: number
  updatedAt: number
  hasFile?: boolean
}

export interface SyncDeletion {
  entity: 'trip' | 'activity' | 'attachment' | 'packing'
  id: string
  deletedAt: number
}

export interface SyncRequest {
  lastRevision: number
  trips: SyncTrip[]
  activities: SyncActivity[]
  packingItems: SyncPackingItem[]
  attachments: SyncAttachment[]
  deletions: SyncDeletion[]
}

export interface SyncResponse {
  cursor: number
  trips: SyncTrip[]
  activities: SyncActivity[]
  packingItems: SyncPackingItem[]
  attachments: SyncAttachment[]
  travelers: SyncTraveler[]
  deletions: SyncDeletion[]
}


export interface TripInvite {
  tripId: string
  name: string
  destination?: string | null
  startDate: string
  endDate: string
  color: string
  emoji: string
  ownerName: string
  ownerEmail: string
  invitedAt: string
}

export interface TripMember {
  userId: string
  email: string
  displayName: string
  color: string
  status: 'pending' | 'accepted'
  invitedAt: string
}

export interface TripMembersPayload {
  me: 'owner' | 'member'
  owner: {
    id: string
    email: string
    displayName: string
    color: string
  }
  members: TripMember[]
}

export interface TripSharePayload {
  token: string | null
}

export interface PublicTripActivity {
  id: string
  name: string
  date: string
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  timeSlot?: TimeSlot | null
  location?: string | null
  type: ActivityType
  completed: boolean
  sortOrder: number
  createdAt: number
}

export interface PublicTripPayload {
  trip: {
    name: string
    destination?: string | null
    startDate: string
    endDate: string
    color: string
    emoji: string
    ownerName: string
  }
  activities: PublicTripActivity[]
}

export interface CityOption {
  id: string
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface GeocodeResponse {
  results: CityOption[]
}

export type WeatherMode = 'forecast' | 'historical' | 'climate'

export interface WeatherDay {
  date: string
  mode: WeatherMode
  available: boolean
  weatherCode: number | null
  tempMax: number | null
  tempMin: number | null
  precipProbability: number | null
  precipSum: number | null
  windMax: number | null
  uvMax: number | null
  sunrise: string | null
  sunset: string | null
  rainYears?: number | null
  climateYears?: number | null
}

export interface WeatherHour {
  time: string
  temp: number
  weatherCode: number
  precipProbability: number | null
  windSpeed: number | null
  isDay: boolean
}

export interface WeatherCurrent {
  time: string
  temp: number
  feelsLike: number | null
  weatherCode: number
  windSpeed: number | null
  isDay: boolean
}

export interface WeatherLocation {
  destinationId?: string
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
  days: WeatherDay[]
  hourly: WeatherHour[]
  current: WeatherCurrent | null
  fetchedAt: number
  attribution: { name: string; url: string }
}

export interface WeatherCacheRecord {
  key: string
  profileId: string
  tripId: string
  destinationId: string
  data: WeatherLocation
  fetchedAt: number
}
