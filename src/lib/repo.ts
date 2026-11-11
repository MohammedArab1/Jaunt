import { db } from '@/db'
import type { Activity, Attachment, Profile, Trip } from '@/types'
import { newId } from './id'
import { timeToMinutes } from './dates'
import { emitLocalChange } from './syncBus'

function insertionIndex(siblings: Activity[], startTime?: string): number {
  if (!startTime) return siblings.length
  const target = timeToMinutes(startTime)

  for (let index = 0; index < siblings.length; index += 1) {
    const sibling = siblings[index]
    if (!sibling.startTime) return index
    if (timeToMinutes(sibling.startTime) > target) return index
  }
  return siblings.length
}

async function renumberDay(profileId: string, date: string): Promise<void> {
  const now = Date.now()
  const siblings = await db.activities.where('[profileId+date]').equals([profileId, date]).toArray()
  siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
  await db.activities.bulkPut(
    siblings.map((activity, index) => ({ ...activity, sortOrder: index, dirty: true, updatedAt: now })),
  )
}

async function queueDeletion(
  profileId: string,
  entity: 'trip' | 'activity' | 'attachment',
  entityId: string,
): Promise<void> {
  const profile = await db.profiles.get(profileId)
  if (profile?.kind !== 'account') return
  await db.deletions.add({
    profileId,
    entity,
    entityId,
    deletedAt: Date.now(),
  })
}

export async function createActivity(activity: Activity): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.activities, async () => {
    const siblings = await db.activities
      .where('[profileId+date]')
      .equals([activity.profileId, activity.date])
      .toArray()
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)

    const index = insertionIndex(siblings, activity.startTime)
    siblings.splice(index, 0, { ...activity, dirty: true, updatedAt: now })
    await db.activities.bulkPut(
      siblings.map((item, order) => ({ ...item, sortOrder: order, dirty: true, updatedAt: now })),
    )
  })
  emitLocalChange()
}

export async function updateActivity(activity: Activity): Promise<void> {
  await db.transaction('rw', db.activities, async () => {
    const existing = await db.activities.get(activity.id)
    if (!existing) return

    const updated = { ...activity, dirty: true, updatedAt: Date.now() }

    if (existing.date === activity.date) {
      await db.activities.put(updated)
      return
    }

    await db.activities.delete(activity.id)
    await renumberDay(activity.profileId, existing.date)

    const siblings = await db.activities
      .where('[profileId+date]')
      .equals([activity.profileId, activity.date])
      .toArray()
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)

    const index = insertionIndex(siblings, activity.startTime)
    siblings.splice(index, 0, updated)
    await db.activities.bulkPut(
      siblings.map((item, order) => ({ ...item, sortOrder: order, dirty: true, updatedAt: updated.updatedAt })),
    )
  })
  emitLocalChange()
}

export async function setActivityCompleted(id: string, completed: boolean): Promise<void> {
  await db.activities.update(id, { completed, dirty: true, updatedAt: Date.now() })
  emitLocalChange()
}

export async function deleteActivity(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.activities, db.attachments, db.files, db.profiles, db.deletions],
    async () => {
      const activity = await db.activities.get(id)
      if (!activity) return

      const attachments = await db.attachments.where('activityId').equals(id).toArray()
      await db.files.bulkDelete(attachments.map((attachment) => attachment.id))
      await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id))
      await db.activities.delete(id)
      await queueDeletion(activity.profileId, 'activity', id)
    },
  )
  emitLocalChange()
}

export async function reorderDay(profileId: string, date: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.activities, async () => {
    const all = await db.activities.where('[profileId+date]').equals([profileId, date]).toArray()
    all.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)

    const subset = new Set(orderedIds)
    const ordered = orderedIds
      .map((id) => all.find((activity) => activity.id === id))
      .filter((activity): activity is Activity => Boolean(activity))

    if (ordered.length !== orderedIds.length) return

    let cursor = 0
    const merged = all.map((activity) => {
      if (!subset.has(activity.id)) return activity
      const next = ordered[cursor]
      cursor += 1
      return next ?? activity
    })

    const now = Date.now()
    await db.activities.bulkPut(
      merged.map((activity, index) => ({ ...activity, sortOrder: index, dirty: true, updatedAt: now })),
    )
  })
  emitLocalChange()
}

export async function sortDayByTime(profileId: string, date: string): Promise<void> {
  await db.transaction('rw', db.activities, async () => {
    const activities = await db.activities.where('[profileId+date]').equals([profileId, date]).toArray()
    activities.sort((a, b) => {
      if (a.startTime && b.startTime) return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      if (a.startTime) return -1
      if (b.startTime) return 1
      return a.sortOrder - b.sortOrder || a.createdAt - b.createdAt
    })
    const now = Date.now()
    await db.activities.bulkPut(
      activities.map((activity, index) => ({ ...activity, sortOrder: index, dirty: true, updatedAt: now })),
    )
  })
  emitLocalChange()
}

export async function saveAttachment(input: {
  activityId: string
  profileId: string
  blob: Blob
  name: string
  mimeType: string
}): Promise<Attachment> {
  const now = Date.now()
  const attachment: Attachment = {
    id: newId(),
    activityId: input.activityId,
    profileId: input.profileId,
    name: input.name,
    mimeType: input.mimeType,
    size: input.blob.size,
    createdAt: now,
    updatedAt: now,
    dirty: true,
    pendingUpload: true,
  }

  await db.transaction('rw', db.attachments, db.files, async () => {
    await db.attachments.add(attachment)
    await db.files.add({ id: attachment.id, blob: input.blob })
  })

  emitLocalChange()
  return attachment
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.attachments, db.files, db.profiles, db.deletions],
    async () => {
      const attachment = await db.attachments.get(id)
      if (!attachment) return

      await db.attachments.delete(id)
      await db.files.delete(id)
      await queueDeletion(attachment.profileId, 'attachment', id)
    },
  )
  emitLocalChange()
}

export async function createTrip(input: {
  profileId: string
  name: string
  destination?: string
  startDate: string
  endDate: string
  color: string
  emoji: string
  notes?: string
}): Promise<Trip> {
  const now = Date.now()
  const trip: Trip = {
    id: newId(),
    profileId: input.profileId,
    name: input.name,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    color: input.color,
    emoji: input.emoji,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    dirty: true,
  }
  await db.trips.add(trip)
  emitLocalChange()
  return trip
}

export async function updateTrip(trip: Trip): Promise<void> {
  await db.trips.put({ ...trip, dirty: true, updatedAt: Date.now() })
  emitLocalChange()
}

export async function deleteTrip(tripId: string, deletePlans: boolean): Promise<void> {
  await db.transaction(
    'rw',
    [db.trips, db.activities, db.attachments, db.files, db.profiles, db.deletions],
    async () => {
      const trip = await db.trips.get(tripId)
      if (!trip) return

      const activities = await db.activities.where('tripId').equals(tripId).toArray()
      const activityIds = activities.map((activity) => activity.id)
      const now = Date.now()

      if (deletePlans) {
        const attachments = activityIds.length
          ? await db.attachments.where('activityId').anyOf(activityIds).toArray()
          : []
        await db.files.bulkDelete(attachments.map((attachment) => attachment.id))
        await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id))
        await db.activities.bulkDelete(activityIds)

        for (const id of activityIds) {
          await queueDeletion(trip.profileId, 'activity', id)
        }
      } else {
        await db.activities
          .where('tripId')
          .equals(tripId)
          .modify((activity) => {
            activity.tripId = undefined
            activity.dirty = true
            activity.updatedAt = now
          })
      }

      await db.trips.delete(tripId)
      await queueDeletion(trip.profileId, 'trip', tripId)
    },
  )
  emitLocalChange()
}

export async function createProfileRecord(name: string, color: string): Promise<Profile> {
  const profile: Profile = {
    id: newId(),
    name: name.trim(),
    color,
    createdAt: Date.now(),
    kind: 'guest',
  }
  await db.profiles.add(profile)
  return profile
}

export async function updateProfileRecord(id: string, patch: Pick<Profile, 'name' | 'color'>): Promise<void> {
  await db.profiles.update(id, { name: patch.name.trim(), color: patch.color })
}

export async function deleteProfileData(profileId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.trips, db.activities, db.attachments, db.files, db.deletions, db.syncMeta],
    async () => {
      const activities = await db.activities.where('profileId').equals(profileId).toArray()
      const activityIds = activities.map((activity) => activity.id)
      const attachments = activityIds.length
        ? await db.attachments.where('activityId').anyOf(activityIds).toArray()
        : []

      await db.files.bulkDelete(attachments.map((attachment) => attachment.id))
      await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id))
      await db.activities.where('profileId').equals(profileId).delete()
      await db.trips.where('profileId').equals(profileId).delete()
      await db.deletions.where('profileId').equals(profileId).delete()
      await db.syncMeta.where('key').startsWith(`sync:${profileId}`).delete()
      await db.profiles.delete(profileId)
    },
  )
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      await navigator.storage.persist()
    }
  } catch {
    // Storage persistence is best effort.
  }
}
