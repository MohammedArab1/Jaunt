import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import type { PoolClient } from 'pg'
import { pool } from '../db.js'
import { currentUser, requireAuth } from '../auth.js'
import {
  acquireSyncLock,
  addTombstones,
  canAccessActivity,
  findTripOwner,
  getAcceptedMemberIds,
  getActivityMeta,
  getActivityParticipants,
  getTripAccess,
  getTripHasMembers,
  getTripParticipantIds,
} from '../tripAccess.js'

const router = Router()

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Invalid date.')

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time.')
  .nullish()

// Only http(s) URLs may be stored. This blocks javascript:/data: URL injection
// when a synced activity is rendered as a link in another user's browser.
const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Use an http or https link.')
  .nullish()

const destinationSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  country: z.string().max(200).nullish(),
  admin1: z.string().max(200).nullish(),
  latitude: z.number().finite().min(-90).max(90).nullish(),
  longitude: z.number().finite().min(-180).max(180).nullish(),
  timezone: z.string().max(100).nullish(),
})

const tripSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  destination: z.string().max(300).nullish(),
  destinations: z.array(destinationSchema).max(10).nullish(),
  startDate: dateString,
  endDate: dateString,
  color: z.string().min(1).max(50),
  emoji: z.string().min(1).max(32),
  notes: z.string().max(10_000).nullish(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const activitySchema = z.object({
  id: z.string().min(1).max(100),
  tripId: z.string().max(100).nullish(),
  destinationId: z.string().max(100).nullish(),
  name: z.string().min(1).max(200),
  date: dateString,
  endDate: dateString.nullish(),
  startTime: timeString,
  endTime: timeString,
  timeSlot: z.enum(['early-morning', 'morning', 'afternoon', 'evening']).nullish(),
  location: z.string().max(300).nullish(),
  type: z.enum(['flight', 'lodging', 'food', 'experience', 'transport', 'event', 'shopping', 'other']),
  notes: z.string().max(10_000).nullish(),
  confirmation: z.string().max(200).nullish(),
  url: httpUrl,
  completed: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const packingItemSchema = z.object({
  id: z.string().min(1).max(100),
  tripId: z.string().min(1).max(100),
  // Optional so older clients can still sync; new clients always send it.
  ownerUserId: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(['documents', 'clothing', 'toiletries', 'electronics', 'gear', 'other']),
  quantity: z.number().int().min(1).max(99),
  packed: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const attachmentSchema = z.object({
  id: z.string().min(1).max(100),
  activityId: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().nonnegative().max(30 * 1024 * 1024),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const deletionSchema = z.object({
  entity: z.enum(['trip', 'activity', 'attachment', 'packing']),
  id: z.string().min(1).max(100),
  deletedAt: z.number().int().nonnegative(),
})

const syncSchema = z.object({
  lastRevision: z.number().int().nonnegative(),
  trips: z.array(tripSchema).max(500).default([]),
  activities: z.array(activitySchema).max(3000).default([]),
  packingItems: z.array(packingItemSchema).max(3000).default([]),
  attachments: z.array(attachmentSchema).max(3000).default([]),
  deletions: z.array(deletionSchema).max(3000).default([]),
})

type SyncRequest = z.infer<typeof syncSchema>

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

async function upsertTrip(
  client: PoolClient,
  ownerId: string,
  trip: SyncRequest['trips'][number],
): Promise<void> {
  await client.query(
    `INSERT INTO trips
       (user_id, id, name, destination, destinations, start_date, end_date, color, emoji, notes,
        created_at, updated_at, revision)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, nextval('sync_revision_seq'))
     ON CONFLICT (user_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       destination = EXCLUDED.destination,
       destinations = COALESCE(EXCLUDED.destinations, trips.destinations),
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       color = EXCLUDED.color,
       emoji = EXCLUDED.emoji,
       notes = EXCLUDED.notes,
       created_at = LEAST(trips.created_at, EXCLUDED.created_at),
       updated_at = EXCLUDED.updated_at,
       revision = nextval('sync_revision_seq')`,
    [
      ownerId,
      trip.id,
      trip.name,
      trip.destination ?? null,
      trip.destinations ? JSON.stringify(trip.destinations) : null,
      trip.startDate,
      trip.endDate,
      trip.color,
      trip.emoji,
      trip.notes ?? null,
      trip.createdAt,
      trip.updatedAt,
    ],
  )
}

async function upsertActivity(
  client: PoolClient,
  ownerId: string,
  activity: SyncRequest['activities'][number] & { resolvedTripId: string | null },
): Promise<void> {
  await client.query(
    `INSERT INTO activities
       (user_id, id, trip_id, destination_id, name, date, end_date, start_time, end_time,
        time_slot, location, type, notes, confirmation, url, completed, sort_order,
        created_at, updated_at, revision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, nextval('sync_revision_seq'))
     ON CONFLICT (user_id, id) DO UPDATE SET
       trip_id = EXCLUDED.trip_id,
       destination_id = EXCLUDED.destination_id,
       name = EXCLUDED.name,
       date = EXCLUDED.date,
       end_date = EXCLUDED.end_date,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       time_slot = EXCLUDED.time_slot,
       location = EXCLUDED.location,
       type = EXCLUDED.type,
       notes = EXCLUDED.notes,
       confirmation = EXCLUDED.confirmation,
       url = EXCLUDED.url,
       completed = EXCLUDED.completed,
       sort_order = EXCLUDED.sort_order,
       created_at = LEAST(activities.created_at, EXCLUDED.created_at),
       updated_at = EXCLUDED.updated_at,
       revision = nextval('sync_revision_seq')`,
    [
      ownerId,
      activity.id,
      activity.resolvedTripId,
      activity.destinationId ?? null,
      activity.name,
      activity.date,
      activity.endDate ?? null,
      activity.startTime ?? null,
      activity.endTime ?? null,
      activity.timeSlot ?? null,
      activity.location ?? null,
      activity.type,
      activity.notes ?? null,
      activity.confirmation ?? null,
      activity.url ?? null,
      activity.completed,
      activity.sortOrder,
      activity.createdAt,
      activity.updatedAt,
    ],
  )
}

async function upsertPackingItem(
  client: PoolClient,
  ownerId: string,
  item: SyncRequest['packingItems'][number] & {
    resolvedTripId: string
    ownerUserId: string
  },
): Promise<void> {
  await client.query(
    `INSERT INTO packing_items
       (user_id, id, trip_id, owner_user_id, name, category, quantity, packed, sort_order,
        created_at, updated_at, revision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, nextval('sync_revision_seq'))
     ON CONFLICT (user_id, id) DO UPDATE SET
       trip_id = EXCLUDED.trip_id,
       owner_user_id = packing_items.owner_user_id,
       name = EXCLUDED.name,
       category = EXCLUDED.category,
       quantity = EXCLUDED.quantity,
       packed = EXCLUDED.packed,
       sort_order = EXCLUDED.sort_order,
       created_at = LEAST(packing_items.created_at, EXCLUDED.created_at),
       updated_at = EXCLUDED.updated_at,
       revision = nextval('sync_revision_seq')`,
    [
      ownerId,
      item.id,
      item.resolvedTripId,
      item.ownerUserId,
      item.name,
      item.category,
      item.quantity,
      item.packed,
      item.sortOrder,
      item.createdAt,
      item.updatedAt,
    ],
  )
}

async function upsertAttachment(
  client: PoolClient,
  ownerId: string,
  attachment: SyncRequest['attachments'][number],
): Promise<void> {
  await client.query(
    `INSERT INTO attachments
       (user_id, id, activity_id, name, mime_type, size, created_at, updated_at, revision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, nextval('sync_revision_seq'))
     ON CONFLICT (user_id, id) DO UPDATE SET
       activity_id = EXCLUDED.activity_id,
       name = EXCLUDED.name,
       mime_type = EXCLUDED.mime_type,
       size = EXCLUDED.size,
       created_at = LEAST(attachments.created_at, EXCLUDED.created_at),
       updated_at = EXCLUDED.updated_at,
       revision = nextval('sync_revision_seq')`,
    [
      ownerId,
      attachment.id,
      attachment.activityId,
      attachment.name,
      attachment.mimeType,
      attachment.size,
      attachment.createdAt,
      attachment.updatedAt,
    ],
  )
}

async function pushTrips(client: PoolClient, userId: string, trips: SyncRequest['trips']): Promise<void> {
  for (const trip of trips) {
    const ownerId = await findTripOwner(client, trip.id)

    if (!ownerId) {
      await upsertTrip(client, userId, trip)
      continue
    }

    if (ownerId === userId) {
      await upsertTrip(client, userId, trip)
      continue
    }

    // Shared trips are owned by someone else. Members can edit plans, but trip details stay owner-only.
    const access = await getTripAccess(client, userId, trip.id)
    if (!access) continue
  }
}

async function pushActivities(
  client: PoolClient,
  userId: string,
  activities: SyncRequest['activities'],
): Promise<void> {
  for (const activity of activities) {
    const existing = await getActivityMeta(client, activity.id)
    let ownerId = userId
    let resolvedTripId = activity.tripId ?? null

    if (existing) {
      if (!(await canAccessActivity(client, userId, existing))) continue
      ownerId = existing.user_id

      if (existing.trip_id) {
        // Once a trip is shared, keep the plan in it. Cross-owner moves are not silently allowed.
        if (await getTripHasMembers(client, existing.trip_id)) {
          resolvedTripId = existing.trip_id
        } else if (resolvedTripId) {
          const target = await getTripAccess(client, userId, resolvedTripId)
          if (!target || target.ownerId !== ownerId) resolvedTripId = existing.trip_id
        }
      } else if (resolvedTripId) {
        const target = await getTripAccess(client, userId, resolvedTripId)
        if (!target || target.ownerId !== ownerId) resolvedTripId = null
      }
    } else if (resolvedTripId) {
      const target = await getTripAccess(client, userId, resolvedTripId)
      if (target) ownerId = target.ownerId
      else resolvedTripId = null
    }

    await upsertActivity(client, ownerId, { ...activity, resolvedTripId })
  }
}

async function pushPackingItems(
  client: PoolClient,
  userId: string,
  items: SyncRequest['packingItems'],
): Promise<void> {
  for (const item of items) {
    const existingResult = await client.query<{
      user_id: string
      trip_id: string
      owner_user_id: string
    }>('SELECT user_id, trip_id, owner_user_id FROM packing_items WHERE id = $1 LIMIT 1', [
      item.id,
    ])
    const existing = existingResult.rows[0]

    if (existing) {
      // A packing list belongs to one traveler. Nobody can edit someone else's list.
      if (existing.owner_user_id !== userId) continue
      const existingAccess = await getTripAccess(client, userId, existing.trip_id)
      if (!existingAccess) continue

      await upsertPackingItem(client, existing.user_id, {
        ...item,
        ownerUserId: existing.owner_user_id,
        resolvedTripId: existing.trip_id,
      })
      continue
    }

    const ownerUserId = item.ownerUserId ?? userId
    if (ownerUserId !== userId) continue
    const access = await getTripAccess(client, userId, item.tripId)
    if (!access) continue

    await upsertPackingItem(client, access.ownerId, {
      ...item,
      ownerUserId,
      resolvedTripId: item.tripId,
    })
  }
}

async function pushAttachments(
  client: PoolClient,
  userId: string,
  attachments: SyncRequest['attachments'],
): Promise<void> {
  for (const attachment of attachments) {
    const activity = await getActivityMeta(client, attachment.activityId)
    if (!activity) continue
    if (!(await canAccessActivity(client, userId, activity))) continue
    await upsertAttachment(client, activity.user_id, attachment)
  }
}

async function applyDeletions(
  client: PoolClient,
  userId: string,
  deletions: SyncRequest['deletions'],
): Promise<void> {
  for (const deletion of deletions) {
    if (deletion.entity === 'packing') {
      const result = await client.query<{
        user_id: string
        trip_id: string
        owner_user_id: string
      }>('SELECT user_id, trip_id, owner_user_id FROM packing_items WHERE id = $1 LIMIT 1', [
        deletion.id,
      ])
      const item = result.rows[0]

      if (!item) {
        // Acknowledge the local delete even if the server never had the row.
        await addTombstones(client, [userId], 'packing', deletion.id, deletion.deletedAt)
        continue
      }

      // Only the traveler who owns the list can remove its items.
      if (item.owner_user_id !== userId) continue
      const access = await getTripAccess(client, userId, item.trip_id)
      if (!access) continue

      const participants = await getTripParticipantIds(client, item.trip_id)
      await client.query('DELETE FROM packing_items WHERE user_id = $1 AND id = $2', [
        item.user_id,
        deletion.id,
      ])
      await addTombstones(client, participants, 'packing', deletion.id, deletion.deletedAt)
      continue
    }

    if (deletion.entity === 'attachment') {
      const result = await client.query<{ user_id: string; activity_id: string }>(
        'SELECT user_id, activity_id FROM attachments WHERE id = $1 LIMIT 1',
        [deletion.id],
      )
      const attachment = result.rows[0]
      const activity = attachment ? await getActivityMeta(client, attachment.activity_id) : null

      if (attachment && activity && (await canAccessActivity(client, userId, activity))) {
        const participants = await getActivityParticipants(client, activity)
        await client.query('DELETE FROM attachments WHERE user_id = $1 AND id = $2', [
          attachment.user_id,
          deletion.id,
        ])
        await addTombstones(client, participants, 'attachment', deletion.id, deletion.deletedAt)
      } else {
        // Acknowledge the local delete even if the server never had the row.
        await addTombstones(client, [userId], 'attachment', deletion.id, deletion.deletedAt)
      }
      continue
    }

    if (deletion.entity === 'activity') {
      const activity = await getActivityMeta(client, deletion.id)
      if (activity && (await canAccessActivity(client, userId, activity))) {
        const participants = await getActivityParticipants(client, activity)
        await client.query('DELETE FROM activities WHERE user_id = $1 AND id = $2', [
          activity.user_id,
          deletion.id,
        ])
        await addTombstones(client, participants, 'activity', deletion.id, deletion.deletedAt)
      } else {
        await addTombstones(client, [userId], 'activity', deletion.id, deletion.deletedAt)
      }
      continue
    }

    // Only a trip owner can delete the trip. Members can leave via the sharing API.
    const ownerId = await findTripOwner(client, deletion.id)
    if (!ownerId || ownerId !== userId) continue

    const memberIds = await getAcceptedMemberIds(client, deletion.id)
    const activities = await client.query<{ id: string }>(
      'SELECT id FROM activities WHERE trip_id = $1 AND user_id = $2',
      [deletion.id, ownerId],
    )

    for (const memberId of memberIds) {
      for (const activity of activities.rows) {
        await addTombstones(client, [memberId], 'activity', activity.id, deletion.deletedAt)
      }
    }

    await addTombstones(client, [ownerId, ...memberIds], 'trip', deletion.id, deletion.deletedAt)
    await client.query('DELETE FROM trip_members WHERE trip_id = $1', [deletion.id])
    await client.query('UPDATE activities SET trip_id = NULL WHERE user_id = $1 AND trip_id = $2', [
      ownerId,
      deletion.id,
    ])
    await client.query('DELETE FROM trips WHERE user_id = $1 AND id = $2', [ownerId, deletion.id])
  }
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = syncSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sync payload.' })
      return
    }

    const userId = currentUser(req).id
    const input = parsed.data
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      // Serialize revision changes with syncs so no client can skip a concurrent commit.
      await acquireSyncLock(client)

      await pushTrips(client, userId, input.trips)
      await pushActivities(client, userId, input.activities)
      await pushPackingItems(client, userId, input.packingItems)
      await pushAttachments(client, userId, input.attachments)
      await applyDeletions(client, userId, input.deletions)

      const tripsResult = await client.query(
        `SELECT t.id, t.name, t.destination, t.destinations, t.start_date::text AS start_date,
                t.end_date::text AS end_date, t.color, t.emoji, t.notes, t.created_at, t.updated_at, t.revision,
                CASE WHEN t.user_id = $1 THEN 'owner' ELSE 'member' END AS role,
                (SELECT COUNT(*)::int FROM trip_members tm
                 WHERE tm.trip_id = t.id AND tm.status = 'accepted') AS member_count
         FROM trips t
         WHERE t.revision > $2 AND (
           t.user_id = $1 OR EXISTS (
             SELECT 1 FROM trip_members m
             WHERE m.trip_id = t.id AND m.user_id = $1 AND m.status = 'accepted'
           )
         )
         ORDER BY t.revision ASC`,
        [userId, input.lastRevision],
      )

      const travelersResult = await client.query(
        `SELECT t.id AS trip_id, u.id, u.display_name, u.color,
                CASE WHEN u.id = t.user_id THEN 'owner' ELSE 'member' END AS role
         FROM trips t
         JOIN users u ON u.id = t.user_id OR EXISTS (
           SELECT 1 FROM trip_members m
           WHERE m.trip_id = t.id AND m.user_id = u.id AND m.status = 'accepted'
         )
         WHERE t.user_id = $1 OR EXISTS (
           SELECT 1 FROM trip_members me
           WHERE me.trip_id = t.id AND me.user_id = $1 AND me.status = 'accepted'
         )
         ORDER BY t.id, CASE WHEN u.id = t.user_id THEN 0 ELSE 1 END, u.display_name`,
        [userId],
      )

      const activitiesResult = await client.query(
        `SELECT a.id, a.trip_id, a.destination_id, a.name, a.date::text AS date,
                a.end_date::text AS end_date, a.start_time, a.end_time, a.time_slot,
                a.location, a.type, a.notes, a.confirmation, a.url, a.completed,
                a.sort_order, a.created_at, a.updated_at, a.revision
         FROM activities a
         WHERE a.revision > $2 AND (
           (a.trip_id IS NULL AND a.user_id = $1) OR EXISTS (
             SELECT 1 FROM trips t
             WHERE t.id = a.trip_id AND (
               t.user_id = $1 OR EXISTS (
                 SELECT 1 FROM trip_members m
                 WHERE m.trip_id = t.id AND m.user_id = $1 AND m.status = 'accepted'
               )
             )
           )
         )
         ORDER BY a.revision ASC`,
        [userId, input.lastRevision],
      )

      const packingItemsResult = await client.query(
        `SELECT p.id, p.trip_id, p.owner_user_id, p.name, p.category, p.quantity, p.packed,
                p.sort_order, p.created_at, p.updated_at, p.revision
         FROM packing_items p
         WHERE p.revision > $2 AND EXISTS (
           SELECT 1 FROM trips t
           WHERE t.id = p.trip_id AND (
             t.user_id = $1 OR EXISTS (
               SELECT 1 FROM trip_members m
               WHERE m.trip_id = t.id AND m.user_id = $1 AND m.status = 'accepted'
             )
           )
         )
         ORDER BY p.revision ASC`,
        [userId, input.lastRevision],
      )

      const attachmentsResult = await client.query(
        `SELECT a.id, a.activity_id, a.name, a.mime_type, a.size, a.created_at, a.updated_at, a.revision,
                EXISTS (
                  SELECT 1 FROM attachment_files f
                  WHERE f.user_id = a.user_id AND f.attachment_id = a.id
                ) AS has_file
         FROM attachments a
         WHERE a.revision > $2 AND EXISTS (
           SELECT 1 FROM activities act
           WHERE act.id = a.activity_id AND (
             (act.trip_id IS NULL AND act.user_id = $1) OR EXISTS (
               SELECT 1 FROM trips t
               WHERE t.id = act.trip_id AND (
                 t.user_id = $1 OR EXISTS (
                   SELECT 1 FROM trip_members m
                   WHERE m.trip_id = t.id AND m.user_id = $1 AND m.status = 'accepted'
                 )
               )
             )
           )
         )
         ORDER BY a.revision ASC`,
        [userId, input.lastRevision],
      )

      const tombstonesResult = await client.query(
        `SELECT entity_type, entity_id, deleted_at, revision
         FROM tombstones
         WHERE user_id = $1 AND revision > $2
         ORDER BY revision ASC`,
        [userId, input.lastRevision],
      )

      await client.query('COMMIT')

      let cursor = input.lastRevision
      const bump = (value: number) => {
        if (value > cursor) cursor = value
      }

      const trips = tripsResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          id: row.id,
          name: row.name,
          destination: row.destination,
          destinations: row.destinations,
          startDate: row.start_date,
          endDate: row.end_date,
          color: row.color,
          emoji: row.emoji,
          notes: row.notes,
          role: row.role as 'owner' | 'member',
          memberCount: Number(row.member_count),
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        }
      })

      const travelers = travelersResult.rows.map((row) => ({
        tripId: row.trip_id,
        id: row.id,
        displayName: row.display_name,
        color: row.color,
        role: row.role as 'owner' | 'member',
      }))

      const activities = activitiesResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          id: row.id,
          tripId: row.trip_id,
          destinationId: row.destination_id,
          name: row.name,
          date: row.date,
          endDate: row.end_date,
          startTime: row.start_time,
          endTime: row.end_time,
          timeSlot: row.time_slot,
          location: row.location,
          type: row.type,
          notes: row.notes,
          confirmation: row.confirmation,
          url: row.url,
          completed: row.completed,
          sortOrder: row.sort_order,
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        }
      })

      const packingItems = packingItemsResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          id: row.id,
          tripId: row.trip_id,
          ownerUserId: row.owner_user_id,
          name: row.name,
          category: row.category,
          quantity: Number(row.quantity),
          packed: row.packed,
          sortOrder: row.sort_order,
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        }
      })

      const attachments = attachmentsResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          id: row.id,
          activityId: row.activity_id,
          name: row.name,
          mimeType: row.mime_type,
          size: Number(row.size),
          hasFile: Boolean(row.has_file),
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        }
      })

      const deletions = tombstonesResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          entity: row.entity_type as 'trip' | 'activity' | 'attachment' | 'packing',
          id: row.entity_id,
          deletedAt: Number(row.deleted_at),
        }
      })

      res.setHeader('Cache-Control', 'no-store')
      res.json({ cursor, trips, activities, packingItems, attachments, travelers, deletions })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)

export default router
