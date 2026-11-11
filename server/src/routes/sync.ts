import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import type { PoolClient } from 'pg'
import { pool } from '../db.js'
import { currentUser, requireAuth } from '../auth.js'

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

const tripSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  destination: z.string().max(300).nullish(),
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
  name: z.string().min(1).max(200),
  date: dateString,
  startTime: timeString,
  endTime: timeString,
  location: z.string().max(300).nullish(),
  type: z.enum(['flight', 'lodging', 'food', 'experience', 'transport', 'event', 'shopping', 'other']),
  notes: z.string().max(10_000).nullish(),
  confirmation: z.string().max(200).nullish(),
  url: z.string().max(1000).nullish(),
  completed: z.boolean(),
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
  entity: z.enum(['trip', 'activity', 'attachment']),
  id: z.string().min(1).max(100),
  deletedAt: z.number().int().nonnegative(),
})

const syncSchema = z.object({
  lastRevision: z.number().int().nonnegative(),
  trips: z.array(tripSchema).max(500).default([]),
  activities: z.array(activitySchema).max(3000).default([]),
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

async function upsertTrips(client: PoolClient, userId: string, trips: SyncRequest['trips']): Promise<void> {
  for (const trip of trips) {
    await client.query(
      `INSERT INTO trips
         (user_id, id, name, destination, start_date, end_date, color, emoji, notes, created_at, updated_at, revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, nextval('sync_revision_seq'))
       ON CONFLICT (user_id, id) DO UPDATE SET
         name = EXCLUDED.name,
         destination = EXCLUDED.destination,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         color = EXCLUDED.color,
         emoji = EXCLUDED.emoji,
         notes = EXCLUDED.notes,
         created_at = LEAST(trips.created_at, EXCLUDED.created_at),
         updated_at = EXCLUDED.updated_at,
         revision = nextval('sync_revision_seq')`,
      [
        userId,
        trip.id,
        trip.name,
        trip.destination ?? null,
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
}

async function upsertActivities(
  client: PoolClient,
  userId: string,
  activities: SyncRequest['activities'],
): Promise<void> {
  const tripRows = await client.query<{ id: string }>('SELECT id FROM trips WHERE user_id = $1', [userId])
  const validTrips = new Set(tripRows.rows.map((row) => row.id))

  for (const activity of activities) {
    const tripId = activity.tripId && validTrips.has(activity.tripId) ? activity.tripId : null
    await client.query(
      `INSERT INTO activities
         (user_id, id, trip_id, name, date, start_time, end_time, location, type, notes,
          confirmation, url, completed, sort_order, created_at, updated_at, revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, nextval('sync_revision_seq'))
       ON CONFLICT (user_id, id) DO UPDATE SET
         trip_id = EXCLUDED.trip_id,
         name = EXCLUDED.name,
         date = EXCLUDED.date,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
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
        userId,
        activity.id,
        tripId,
        activity.name,
        activity.date,
        activity.startTime ?? null,
        activity.endTime ?? null,
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
}

async function upsertAttachments(
  client: PoolClient,
  userId: string,
  attachments: SyncRequest['attachments'],
): Promise<void> {
  const activityRows = await client.query<{ id: string }>('SELECT id FROM activities WHERE user_id = $1', [
    userId,
  ])
  const validActivities = new Set(activityRows.rows.map((row) => row.id))

  for (const attachment of attachments) {
    if (!validActivities.has(attachment.activityId)) continue

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
        userId,
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
}

async function insertTombstone(
  client: PoolClient,
  userId: string,
  entity: 'trip' | 'activity' | 'attachment',
  entityId: string,
  deletedAt: number,
): Promise<void> {
  await client.query(
    `INSERT INTO tombstones (user_id, entity_type, entity_id, deleted_at, revision)
     VALUES ($1, $2, $3, $4, nextval('sync_revision_seq'))
     ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
       deleted_at = EXCLUDED.deleted_at,
       revision = nextval('sync_revision_seq')`,
    [userId, entity, entityId, deletedAt],
  )
}

async function applyDeletions(client: PoolClient, userId: string, deletions: SyncRequest['deletions']): Promise<void> {
  for (const deletion of deletions) {
    if (deletion.entity === 'attachment') {
      await client.query('DELETE FROM attachment_files WHERE user_id = $1 AND attachment_id = $2', [
        userId,
        deletion.id,
      ])
      await client.query('DELETE FROM attachments WHERE user_id = $1 AND id = $2', [userId, deletion.id])
    } else if (deletion.entity === 'activity') {
      await client.query('DELETE FROM activities WHERE user_id = $1 AND id = $2', [userId, deletion.id])
    } else {
      await client.query('UPDATE activities SET trip_id = NULL WHERE user_id = $1 AND trip_id = $2', [
        userId,
        deletion.id,
      ])
      await client.query('DELETE FROM trips WHERE user_id = $1 AND id = $2', [userId, deletion.id])
    }

    await insertTombstone(client, userId, deletion.entity, deletion.id, deletion.deletedAt)
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
      // Serialize syncs for this user so the revision cursor cannot skip a concurrent commit.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [userId])

      await upsertTrips(client, userId, input.trips)
      await upsertActivities(client, userId, input.activities)
      await upsertAttachments(client, userId, input.attachments)
      await applyDeletions(client, userId, input.deletions)

      const tripsResult = await client.query(
        `SELECT id, name, destination, start_date::text AS start_date, end_date::text AS end_date,
                color, emoji, notes, created_at, updated_at, revision
         FROM trips
         WHERE user_id = $1 AND revision > $2
         ORDER BY revision ASC`,
        [userId, input.lastRevision],
      )

      const activitiesResult = await client.query(
        `SELECT id, trip_id, name, date::text AS date, start_time, end_time, location, type, notes,
                confirmation, url, completed, sort_order, created_at, updated_at, revision
         FROM activities
         WHERE user_id = $1 AND revision > $2
         ORDER BY revision ASC`,
        [userId, input.lastRevision],
      )

      const attachmentsResult = await client.query(
        `SELECT a.id, a.activity_id, a.name, a.mime_type, a.size, a.created_at, a.updated_at, a.revision,
                EXISTS (
                  SELECT 1 FROM attachment_files f
                  WHERE f.user_id = a.user_id AND f.attachment_id = a.id
                ) AS has_file
         FROM attachments a
         WHERE a.user_id = $1 AND a.revision > $2
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
          startDate: row.start_date,
          endDate: row.end_date,
          color: row.color,
          emoji: row.emoji,
          notes: row.notes,
          createdAt: Number(row.created_at),
          updatedAt: Number(row.updated_at),
        }
      })

      const activities = activitiesResult.rows.map((row) => {
        bump(Number(row.revision))
        return {
          id: row.id,
          tripId: row.trip_id,
          name: row.name,
          date: row.date,
          startTime: row.start_time,
          endTime: row.end_time,
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
          entity: row.entity_type as 'trip' | 'activity' | 'attachment',
          id: row.entity_id,
          deletedAt: Number(row.deleted_at),
        }
      })

      res.setHeader('Cache-Control', 'no-store')
      res.json({ cursor, trips, activities, attachments, deletions })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)

export default router
