export type ActivityType =
  | 'flight'
  | 'lodging'
  | 'food'
  | 'experience'
  | 'transport'
  | 'event'
  | 'shopping'
  | 'other'

export interface Profile {
  id: string
  name: string
  color: string
  createdAt: number
  kind?: 'guest' | 'account'
}

export interface Trip {
  id: string
  profileId: string
  name: string
  destination?: string
  startDate: string
  endDate: string
  color: string
  emoji: string
  notes?: string
  createdAt: number
  updatedAt: number
  dirty?: boolean
}

export interface Activity {
  id: string
  profileId: string
  tripId?: string
  name: string
  date: string
  startTime?: string
  endTime?: string
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
  entity: 'trip' | 'activity' | 'attachment'
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
  startDate: string
  endDate: string
  color: string
  emoji: string
  notes?: string | null
  createdAt: number
  updatedAt: number
}

export interface SyncActivity {
  id: string
  tripId?: string | null
  name: string
  date: string
  startTime?: string | null
  endTime?: string | null
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
  entity: 'trip' | 'activity' | 'attachment'
  id: string
  deletedAt: number
}

export interface SyncRequest {
  lastRevision: number
  trips: SyncTrip[]
  activities: SyncActivity[]
  attachments: SyncAttachment[]
  deletions: SyncDeletion[]
}

export interface SyncResponse {
  cursor: number
  trips: SyncTrip[]
  activities: SyncActivity[]
  attachments: SyncAttachment[]
  deletions: SyncDeletion[]
}
