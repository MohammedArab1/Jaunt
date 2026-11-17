import { db } from '@/db'
import type { Attachment } from '@/types'
import { newId } from './id'
import { emitLocalChange } from './syncBus'

export interface ImportResult {
  trips: number
  activities: number
  packingItems: number
  attachments: number
}

export async function importGuestProfileIntoAccount(
  guestProfileId: string,
  accountUserId: string,
): Promise<ImportResult> {
  const now = Date.now()

  const result = await db.transaction(
    'rw',
    [db.profiles, db.trips, db.activities, db.packingItems, db.attachments, db.files],
    async () => {
      const guest = await db.profiles.get(guestProfileId)
      const account = await db.profiles.get(accountUserId)
      if (!guest || guest.kind === 'account') throw new Error('That offline profile was not found.')
      if (!account || account.kind !== 'account') throw new Error('Your account is not ready yet.')

      const guestTrips = await db.trips.where('profileId').equals(guestProfileId).toArray()
      const guestActivities = await db.activities.where('profileId').equals(guestProfileId).toArray()
      const guestPackingItems = await db.packingItems.where('profileId').equals(guestProfileId).toArray()
      const attachments = await db.attachments.where('profileId').equals(guestProfileId).toArray()

      const tripIdMap = new Map<string, string>()
      const newTrips = guestTrips.map((trip) => {
        const id = newId()
        tripIdMap.set(trip.id, id)
        return {
          ...trip,
          id,
          profileId: accountUserId,
          createdAt: trip.createdAt,
          updatedAt: now,
          dirty: true,
          role: 'owner' as const,
          memberCount: 0,
        }
      })

      const activityIdMap = new Map<string, string>()
      const newActivities = guestActivities.map((activity) => {
        const id = newId()
        activityIdMap.set(activity.id, id)
        return {
          ...activity,
          id,
          profileId: accountUserId,
          tripId: activity.tripId ? tripIdMap.get(activity.tripId) : undefined,
          createdAt: activity.createdAt,
          updatedAt: now,
          dirty: true,
        }
      })

      const newPackingItems = guestPackingItems.flatMap((item) => {
        const tripId = tripIdMap.get(item.tripId)
        if (!tripId) return []
        return [
          {
            ...item,
            id: newId(),
            profileId: accountUserId,
            tripId,
            ownerUserId: accountUserId,
            createdAt: item.createdAt,
            updatedAt: now,
            dirty: true,
          },
        ]
      })

      const newAttachments: Array<{ attachment: Attachment; blob: Blob }> = []

      for (const attachment of attachments) {
        const newActivityId = activityIdMap.get(attachment.activityId)
        if (!newActivityId) continue
        const file = await db.files.get(attachment.id)
        if (!file) continue

        newAttachments.push({
          attachment: {
            ...attachment,
            id: newId(),
            activityId: newActivityId,
            profileId: accountUserId,
            createdAt: attachment.createdAt,
            updatedAt: now,
            dirty: true,
            pendingUpload: true,
          },
          blob: file.blob,
        })
      }

      if (newTrips.length) await db.trips.bulkPut(newTrips)
      if (newActivities.length) await db.activities.bulkPut(newActivities)
      if (newPackingItems.length) await db.packingItems.bulkPut(newPackingItems)

      for (const item of newAttachments) {
        await db.attachments.put(item.attachment)
        await db.files.put({ id: item.attachment.id, blob: item.blob })
      }

      return {
        trips: newTrips.length,
        activities: newActivities.length,
        packingItems: newPackingItems.length,
        attachments: newAttachments.length,
      }
    },
  )

  emitLocalChange()
  return result
}
