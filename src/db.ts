import Dexie, { type Table } from 'dexie'
import type {
  Activity,
  Attachment,
  FileRecord,
  PendingDeletion,
  Profile,
  SyncState,
  Trip,
} from '@/types'

class JauntDB extends Dexie {
  profiles!: Table<Profile, string>
  trips!: Table<Trip, string>
  activities!: Table<Activity, string>
  attachments!: Table<Attachment, string>
  files!: Table<FileRecord, string>
  deletions!: Table<PendingDeletion, number>
  syncMeta!: Table<SyncState, string>

  constructor() {
    super('jaunt')

    this.version(1).stores({
      profiles: 'id, createdAt',
      trips: 'id, profileId, startDate, endDate',
      activities: 'id, profileId, tripId, date, completed, [profileId+date], [profileId+tripId]',
      attachments: 'id, activityId, profileId, [profileId+activityId]',
      files: 'id',
    })

    this.version(2).stores({
      profiles: 'id, createdAt, kind',
      trips: 'id, profileId, startDate, endDate',
      activities: 'id, profileId, tripId, date, completed, [profileId+date], [profileId+tripId]',
      attachments: 'id, activityId, profileId, [profileId+activityId]',
      files: 'id',
      deletions: '++id, profileId, entity, entityId',
      syncMeta: 'key',
    })
  }
}

export const db = new JauntDB()

export const ACTIVE_PROFILE_KEY = 'jaunt.activeProfileId'
