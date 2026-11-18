import { db } from '@/db'
import type { Backup, BackupFile, Profile } from '@/types'
import { isPackingCategory } from './packing'
import { todayKey } from './dates'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read a ticket file.'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function buildBackup(): Promise<Backup> {
  const allProfiles = await db.profiles.toArray()
  const profiles = allProfiles.filter((profile) => profile.kind !== 'account')
  const profileIds = profiles.map((profile) => profile.id)

  const trips = profileIds.length
    ? await db.trips.where('profileId').anyOf(profileIds).toArray()
    : []
  const activities = profileIds.length
    ? await db.activities.where('profileId').anyOf(profileIds).toArray()
    : []
  const packingItems = profileIds.length
    ? await db.packingItems.where('profileId').anyOf(profileIds).toArray()
    : []
  const attachments = profileIds.length
    ? await db.attachments.where('profileId').anyOf(profileIds).toArray()
    : []

  const files = await db.files.bulkGet(attachments.map((attachment) => attachment.id))

  const backupAttachments: BackupFile[] = []
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index]
    const blob = files[index]?.blob
    if (!blob) continue
    backupAttachments.push({
      ...attachment,
      data: await blobToBase64(blob),
    })
  }

  return {
    format: 'jaunt-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    trips,
    activities,
    packingItems,
    attachments: backupAttachments,
  }
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `jaunt-backup-${todayKey()}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validateBackup(value: unknown): value is Backup {
  if (!isRecord(value)) return false
  return (
    value.format === 'jaunt-backup' &&
    value.version === 1 &&
    Array.isArray(value.profiles) &&
    Array.isArray(value.trips) &&
    Array.isArray(value.activities) &&
    Array.isArray(value.attachments)
  )
}

export async function restoreBackup(text: string): Promise<Backup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (!validateBackup(parsed)) {
    throw new Error('That does not look like a Jaunt backup file.')
  }

  const backupProfiles = parsed.profiles.filter((profile) => profile.kind !== 'account')
  const profileIds = new Set(backupProfiles.map((profile) => profile.id))

  const records = parsed.attachments
    .filter((attachment) => profileIds.has(attachment.profileId))
    .map((attachment) => ({
      attachment: {
        id: String(attachment.id),
        activityId: String(attachment.activityId),
        profileId: String(attachment.profileId),
        name: String(attachment.name),
        mimeType: String(attachment.mimeType),
        size: Number(attachment.size) || 0,
        createdAt: Number(attachment.createdAt) || Date.now(),
        updatedAt: Number(attachment.updatedAt) || Number(attachment.createdAt) || Date.now(),
        dirty: false,
        pendingUpload: false,
      },
      file: {
        id: String(attachment.id),
        blob: base64ToBlob(String(attachment.data ?? ''), String(attachment.mimeType || 'application/octet-stream')),
      },
    }))

  const restoredTripIds = new Set(
    parsed.trips
      .filter((trip) => profileIds.has(trip.profileId))
      .map((trip) => String(trip.id)),
  )
  const packingItems = (Array.isArray(parsed.packingItems) ? parsed.packingItems : [])
    .filter(
      (item) =>
        profileIds.has(String(item.profileId)) && restoredTripIds.has(String(item.tripId)),
    )
    .map((item) => ({
      id: String(item.id),
      profileId: String(item.profileId),
      tripId: String(item.tripId),
      ownerUserId: String(item.ownerUserId ?? item.profileId),
      name: String(item.name ?? '').trim() || 'Packing item',
      category: isPackingCategory(item.category) ? item.category : ('other' as const),
      quantity: Math.min(99, Math.max(1, Math.round(Number(item.quantity) || 1))),
      packed: Boolean(item.packed),
      sortOrder: Number(item.sortOrder) || 0,
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
      dirty: false,
    }))

  await db.transaction(
    'rw',
    [
      db.profiles,
      db.trips,
      db.activities,
      db.packingItems,
      db.attachments,
      db.files,
      db.weatherCache,
      db.deletions,
    ],
    async () => {
      const existingProfiles = await db.profiles.toArray()
      const guestIds = existingProfiles
        .filter((profile) => profile.kind !== 'account')
        .map((profile) => profile.id)

      if (guestIds.length) {
        const existingAttachments = await db.attachments.where('profileId').anyOf(guestIds).toArray()
        const attachmentIds = existingAttachments.map((attachment) => attachment.id)
        if (attachmentIds.length) {
          await db.files.bulkDelete(attachmentIds)
          await db.attachments.bulkDelete(attachmentIds)
        }
        await db.activities.where('profileId').anyOf(guestIds).delete()
        await db.packingItems.where('profileId').anyOf(guestIds).delete()
        await db.weatherCache.where('profileId').anyOf(guestIds).delete()
        await db.trips.where('profileId').anyOf(guestIds).delete()
        await db.deletions.where('profileId').anyOf(guestIds).delete()
        await db.profiles.bulkDelete(guestIds)
      }

      if (backupProfiles.length) {
        const profiles: Profile[] = backupProfiles.map((profile) => ({
          ...profile,
          kind: 'guest',
        }))
        await db.profiles.bulkAdd(profiles)
      }
      if (parsed.trips.length) {
        await db.trips.bulkAdd(parsed.trips.filter((trip) => profileIds.has(trip.profileId)))
      }
      if (parsed.activities.length) {
        await db.activities.bulkAdd(
          parsed.activities.filter((activity) => profileIds.has(activity.profileId)),
        )
      }
      if (packingItems.length) {
        await db.packingItems.bulkAdd(packingItems)
      }
      if (records.length) {
        await db.attachments.bulkAdd(records.map((record) => record.attachment))
        await db.files.bulkAdd(records.map((record) => record.file))
      }
    },
  )

  return parsed
}
