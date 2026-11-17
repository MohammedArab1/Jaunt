import { db } from '@/db'
import { ApiError, api } from './api'
import type {
  Activity,
  Attachment,
  PackingItem,
  SyncActivity,
  SyncAttachment,
  SyncDeletion,
  SyncPackingItem,
  SyncRequest,
  SyncTrip,
  Trip,
  TripTraveler,
} from '@/types'

export class SyncAbortedError extends Error {
  constructor() {
    super('Sync stopped because the account is no longer active on this device.')
    this.name = 'SyncAbortedError'
  }
}

export interface SyncResult {
  cursor: number
  pushed: number
  pulled: number
  uploaded: number
  downloaded: number
  lastSyncedAt: number
}

export function syncStateKey(userId: string): string {
  return `sync:${userId}`
}

function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

function toSyncTrip(trip: Trip): SyncTrip {
  return {
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    color: trip.color,
    emoji: trip.emoji,
    notes: trip.notes,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  }
}

function toSyncActivity(activity: Activity): SyncActivity {
  return {
    id: activity.id,
    tripId: activity.tripId,
    name: activity.name,
    date: activity.date,
    endDate: activity.endDate,
    startTime: activity.startTime,
    timeSlot: activity.timeSlot,
    endTime: activity.endTime,
    location: activity.location,
    type: activity.type,
    notes: activity.notes,
    confirmation: activity.confirmation,
    url: activity.url,
    completed: activity.completed,
    sortOrder: activity.sortOrder,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  }
}

function toSyncPackingItem(item: PackingItem): SyncPackingItem {
  return {
    id: item.id,
    tripId: item.tripId,
    ownerUserId: item.ownerUserId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    packed: item.packed,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toSyncAttachment(attachment: Attachment): SyncAttachment {
  return {
    id: attachment.id,
    activityId: attachment.activityId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  }
}

function toLocalTrip(trip: SyncTrip, profileId: string, existing?: Trip): Trip {
  return {
    id: trip.id,
    profileId,
    name: trip.name,
    destination: optional(trip.destination),
    startDate: trip.startDate,
    endDate: trip.endDate,
    color: trip.color,
    emoji: trip.emoji,
    notes: optional(trip.notes),
    role: trip.role ?? 'owner',
    memberCount: trip.memberCount ?? 0,
    travelers: existing?.travelers,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    dirty: false,
  }
}

function toLocalActivity(activity: SyncActivity, profileId: string): Activity {
  return {
    id: activity.id,
    profileId,
    tripId: optional(activity.tripId),
    name: activity.name,
    date: activity.date,
    endDate: optional(activity.endDate),
    startTime: optional(activity.startTime),
    timeSlot: optional(activity.timeSlot),
    endTime: optional(activity.endTime),
    location: optional(activity.location),
    type: activity.type,
    notes: optional(activity.notes),
    confirmation: optional(activity.confirmation),
    url: optional(activity.url),
    completed: activity.completed,
    sortOrder: activity.sortOrder,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    dirty: false,
  }
}

function toLocalPackingItem(item: SyncPackingItem, profileId: string): PackingItem {
  return {
    id: item.id,
    profileId,
    tripId: item.tripId,
    ownerUserId: item.ownerUserId ?? profileId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    packed: item.packed,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    dirty: false,
  }
}

function toLocalAttachment(
  attachment: SyncAttachment,
  profileId: string,
  existing?: Attachment,
): Attachment {
  return {
    id: attachment.id,
    activityId: attachment.activityId,
    profileId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
    dirty: false,
    pendingUpload: existing?.pendingUpload ?? false,
  }
}

async function accountFullCacheIsActive(userId: string): Promise<boolean> {
  const profile = await db.profiles.get(userId)
  return profile?.kind === 'account'
}

async function applyRemoteDeletion(userId: string, deletion: SyncDeletion): Promise<void> {
  if (deletion.entity === 'trip') {
    const localTrip = await db.trips.get(deletion.id)
    const shared = localTrip?.role === 'member'
    const tripActivities = await db.activities
      .where('[profileId+tripId]')
      .equals([userId, deletion.id])
      .toArray()

    if (shared) {
      const activityIds = tripActivities.map((activity) => activity.id)
      if (activityIds.length) {
        const attachments = await db.attachments.where('activityId').anyOf(activityIds).toArray()
        await db.files.bulkDelete(attachments.map((attachment) => attachment.id))
        await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id))
        await db.activities.bulkDelete(activityIds)
      }
    } else {
      await db.activities
        .where('[profileId+tripId]')
        .equals([userId, deletion.id])
        .modify((activity) => {
          activity.tripId = undefined
        })
    }

    await db.packingItems.where('tripId').equals(deletion.id).delete()
    await db.trips.delete(deletion.id)
  } else if (deletion.entity === 'activity') {
    const attachments = await db.attachments.where('activityId').equals(deletion.id).toArray()
    if (attachments.length) {
      await db.files.bulkDelete(attachments.map((attachment) => attachment.id))
      await db.attachments.bulkDelete(attachments.map((attachment) => attachment.id))
    }
    await db.activities.delete(deletion.id)
  } else if (deletion.entity === 'packing') {
    await db.packingItems.delete(deletion.id)
  } else {
    await db.attachments.delete(deletion.id)
    await db.files.delete(deletion.id)
  }

  await db.deletions.where({ entity: deletion.entity, entityId: deletion.id }).delete()
}

async function uploadPendingFiles(userId: string): Promise<number> {
  const pending = await db.attachments
    .where('profileId')
    .equals(userId)
    .filter((attachment) => Boolean(attachment.pendingUpload) && !attachment.dirty)
    .toArray()

  let uploaded = 0
  for (const attachment of pending) {
    if (!(await accountFullCacheIsActive(userId))) throw new SyncAbortedError()

    const file = await db.files.get(attachment.id)
    if (!file) {
      await db.attachments.update(attachment.id, { pendingUpload: false })
      continue
    }

    await api.uploadAttachment(attachment.id, file.blob, attachment.mimeType)
    await db.attachments.update(attachment.id, { pendingUpload: false })
    uploaded += 1
  }

  return uploaded
}

async function downloadAttachmentFile(attachmentId: string): Promise<Blob | null> {
  try {
    const blob = await api.downloadAttachment(attachmentId)
    const attachment = await db.attachments.get(attachmentId)
    if (!attachment) return null
    await db.files.put({ id: attachmentId, blob })
    return blob
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

async function downloadFiles(ids: string[]): Promise<number> {
  const unique = [...new Set(ids)]
  let downloaded = 0

  for (let index = 0; index < unique.length; index += 3) {
    const chunk = unique.slice(index, index + 3)
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        const existing = await db.files.get(id)
        if (existing) return false
        await downloadAttachmentFile(id)
        return true
      }),
    )
    downloaded += results.filter((result) => result.status === 'fulfilled' && result.value === true).length
  }

  return downloaded
}

export async function ensureAttachmentBlob(attachmentId: string): Promise<Blob | undefined> {
  const local = await db.files.get(attachmentId)
  if (local) return local.blob

  const attachment = await db.attachments.get(attachmentId)
  if (!attachment) return undefined
  const profile = await db.profiles.get(attachment.profileId)
  if (profile?.kind !== 'account') return undefined

  try {
    return (await downloadAttachmentFile(attachmentId)) ?? undefined
  } catch {
    return undefined
  }
}

export async function runSync(userId: string): Promise<SyncResult> {
  if (!(await accountFullCacheIsActive(userId))) {
    throw new SyncAbortedError()
  }

  const state = await db.syncMeta.get(syncStateKey(userId))

  const [dirtyTrips, dirtyActivities, dirtyPackingItems, dirtyAttachments, pendingDeletions] =
    await Promise.all([
      db.trips.where('profileId').equals(userId).filter((trip) => Boolean(trip.dirty)).toArray(),
      db.activities.where('profileId').equals(userId).filter((activity) => Boolean(activity.dirty)).toArray(),
      db.packingItems.where('profileId').equals(userId).filter((item) => Boolean(item.dirty)).toArray(),
      db.attachments.where('profileId').equals(userId).filter((attachment) => Boolean(attachment.dirty)).toArray(),
      db.deletions.where('profileId').equals(userId).toArray(),
    ])

  const request: SyncRequest = {
    lastRevision: state?.lastRevision ?? 0,
    trips: dirtyTrips.map(toSyncTrip),
    activities: dirtyActivities.map(toSyncActivity),
    packingItems: dirtyPackingItems.map(toSyncPackingItem),
    attachments: dirtyAttachments.map(toSyncAttachment),
    deletions: pendingDeletions.map((deletion) => ({
      entity: deletion.entity,
      id: deletion.entityId,
      deletedAt: deletion.deletedAt,
    })),
  }

  const response = await api.sync(request)

  if (!(await accountFullCacheIsActive(userId))) {
    throw new SyncAbortedError()
  }

  const pushedTrips = new Map(dirtyTrips.map((trip) => [trip.id, trip.updatedAt]))
  const pushedActivities = new Map(dirtyActivities.map((activity) => [activity.id, activity.updatedAt]))
  const pushedPackingItems = new Map(dirtyPackingItems.map((item) => [item.id, item.updatedAt]))
  const pushedAttachments = new Map(dirtyAttachments.map((attachment) => [attachment.id, attachment.updatedAt]))
  const includedDeletionIds = pendingDeletions
    .map((deletion) => deletion.id)
    .filter((id): id is number => typeof id === 'number')
  const downloadIds: string[] = []
  const now = Date.now()

  await db.transaction(
    'rw',
    [
      db.profiles,
      db.trips,
      db.activities,
      db.packingItems,
      db.attachments,
      db.files,
      db.deletions,
      db.syncMeta,
    ],
    async () => {
      if (!(await db.profiles.get(userId).then((profile) => profile?.kind === 'account'))) {
        throw new SyncAbortedError()
      }

      const currentDeletions = await db.deletions.where('profileId').equals(userId).toArray()
      const pendingKeys = new Set(currentDeletions.map((deletion) => `${deletion.entity}:${deletion.entityId}`))

      for (const trip of response.trips) {
        if (pendingKeys.has(`trip:${trip.id}`)) continue
        const local = await db.trips.get(trip.id)
        if (local?.dirty) {
          if (pushedTrips.get(trip.id) === local.updatedAt) {
            await db.trips.put(toLocalTrip(trip, userId, local))
          }
          continue
        }
        await db.trips.put(toLocalTrip(trip, userId, local))
      }

      const travelersByTrip = new Map<string, TripTraveler[]>()
      for (const traveler of response.travelers ?? []) {
        const list = travelersByTrip.get(traveler.tripId) ?? []
        list.push({
          id: traveler.id,
          displayName: traveler.displayName,
          color: traveler.color,
          role: traveler.role,
        })
        travelersByTrip.set(traveler.tripId, list)
      }
      for (const [tripId, travelers] of travelersByTrip) {
        const local = await db.trips.get(tripId)
        if (local) await db.trips.update(tripId, { travelers })
      }

      for (const activity of response.activities) {
        if (pendingKeys.has(`activity:${activity.id}`)) continue
        const local = await db.activities.get(activity.id)
        if (local?.dirty) {
          if (pushedActivities.get(activity.id) === local.updatedAt) {
            await db.activities.put(toLocalActivity(activity, userId))
          }
          continue
        }
        await db.activities.put(toLocalActivity(activity, userId))
      }

      for (const item of response.packingItems) {
        if (pendingKeys.has(`packing:${item.id}`)) continue
        const local = await db.packingItems.get(item.id)
        if (local?.dirty) {
          if (pushedPackingItems.get(item.id) === local.updatedAt) {
            await db.packingItems.put(toLocalPackingItem(item, userId))
          }
          continue
        }
        await db.packingItems.put(toLocalPackingItem(item, userId))
      }

      for (const attachment of response.attachments) {
        if (pendingKeys.has(`attachment:${attachment.id}`)) continue
        const local = await db.attachments.get(attachment.id)
        if (local?.dirty) {
          if (pushedAttachments.get(attachment.id) === local.updatedAt) {
            await db.attachments.put(toLocalAttachment(attachment, userId, local))
          }
          continue
        }
        await db.attachments.put(toLocalAttachment(attachment, userId, local))
        if (attachment.hasFile) downloadIds.push(attachment.id)
      }

      for (const deletion of response.deletions) {
        await applyRemoteDeletion(userId, deletion)
      }

      // Mark pushed rows clean even if the response omitted them for any reason.
      for (const [id, updatedAt] of pushedTrips) {
        const local = await db.trips.get(id)
        if (local?.dirty && local.updatedAt === updatedAt) await db.trips.update(id, { dirty: false })
      }
      for (const [id, updatedAt] of pushedActivities) {
        const local = await db.activities.get(id)
        if (local?.dirty && local.updatedAt === updatedAt) await db.activities.update(id, { dirty: false })
      }
      for (const [id, updatedAt] of pushedPackingItems) {
        const local = await db.packingItems.get(id)
        if (local?.dirty && local.updatedAt === updatedAt) await db.packingItems.update(id, { dirty: false })
      }
      for (const [id, updatedAt] of pushedAttachments) {
        const local = await db.attachments.get(id)
        if (local?.dirty && local.updatedAt === updatedAt) await db.attachments.update(id, { dirty: false })
      }

      if (includedDeletionIds.length) {
        await db.deletions.bulkDelete(includedDeletionIds)
      }

      await db.syncMeta.put({
        key: syncStateKey(userId),
        lastRevision: response.cursor,
        lastSyncedAt: now,
      })
    },
  )

  if (!(await accountFullCacheIsActive(userId))) {
    throw new SyncAbortedError()
  }

  const uploaded = await uploadPendingFiles(userId)
  const downloaded = await downloadFiles(downloadIds)

  return {
    cursor: response.cursor,
    pushed:
      dirtyTrips.length +
      dirtyActivities.length +
      dirtyPackingItems.length +
      dirtyAttachments.length +
      pendingDeletions.length,
    pulled:
      response.trips.length +
      response.activities.length +
      response.packingItems.length +
      response.attachments.length +
      response.deletions.length,
    uploaded,
    downloaded,
    lastSyncedAt: now,
  }
}

export { downloadAttachmentFile }
