import { db } from '@/db'
import type { AuthUser } from '@/types'

export async function hasAccountCache(userId: string): Promise<boolean> {
  const profile = await db.profiles.get(userId)
  return profile?.kind === 'account'
}

export async function ensureAccountProfile(user: AuthUser): Promise<void> {
  const existing = await db.profiles.get(user.id)
  const next = {
    id: user.id,
    name: user.displayName,
    color: user.color,
    kind: 'account' as const,
  }

  if (!existing) {
    await db.profiles.add({ ...next, createdAt: Date.now() })
    return
  }

  if (
    existing.kind !== 'account' ||
    existing.name !== next.name ||
    existing.color !== next.color ||
    existing.id !== user.id
  ) {
    await db.profiles.put({
      ...existing,
      ...next,
      createdAt: existing.createdAt,
    })
  }
}

export async function clearAccountCache(userId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.trips, db.activities, db.attachments, db.files, db.deletions, db.syncMeta],
    async () => {
      const attachments = await db.attachments.where('profileId').equals(userId).toArray()
      const attachmentIds = attachments.map((attachment) => attachment.id)

      if (attachmentIds.length) {
        await db.files.bulkDelete(attachmentIds)
        await db.attachments.bulkDelete(attachmentIds)
      }

      await db.activities.where('profileId').equals(userId).delete()
      await db.trips.where('profileId').equals(userId).delete()
      await db.deletions.where('profileId').equals(userId).delete()
      await db.syncMeta.where('key').startsWith(`sync:${userId}`).delete()
      const profile = await db.profiles.get(userId)
      if (profile?.kind === 'account') {
        await db.profiles.delete(userId)
      }
    },
  )
}
