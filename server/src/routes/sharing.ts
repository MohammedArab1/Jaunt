import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'
import { currentUser, requireAuth } from '../auth.js'
import {
  acquireSyncLock,
  addTombstones,
  bumpTripRevisions,
  findTripOwner,
  getTripAccess,
} from '../tripAccess.js'

const router = Router()

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

interface MemberRow {
  user_id: string
  email: string
  display_name: string
  status: 'pending' | 'accepted'
  created_at: string
  color: string
}

interface OwnerRow {
  id: string
  email: string
  display_name: string
  color: string
}

async function getOwner(tripId: string): Promise<OwnerRow | null> {
  const result = await pool.query<OwnerRow>(
    `SELECT u.id, u.email, u.display_name, u.color
     FROM trips t JOIN users u ON u.id = t.user_id
     WHERE t.id = $1`,
    [tripId],
  )
  return result.rows[0] ?? null
}

async function getMemberRows(tripId: string, includePending: boolean): Promise<MemberRow[]> {
  const result = await pool.query<MemberRow>(
    `SELECT m.user_id, u.email, u.display_name, u.color, m.status, m.created_at::text
     FROM trip_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.trip_id = $1 ${includePending ? '' : "AND m.status = 'accepted'"}
     ORDER BY m.created_at ASC`,
    [tripId],
  )
  return result.rows
}

router.get(
  '/invites',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const result = await pool.query(
      `SELECT t.id, t.name, t.destination, t.start_date::text AS start_date, t.end_date::text AS end_date,
              t.color, t.emoji, u.display_name AS owner_name, u.email AS owner_email, m.created_at::text
       FROM trip_members m
       JOIN trips t ON t.id = m.trip_id
       JOIN users u ON u.id = t.user_id
       WHERE m.user_id = $1 AND m.status = 'pending'
       ORDER BY m.created_at DESC`,
      [userId],
    )

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      invites: result.rows.map((row) => ({
        tripId: row.id,
        name: row.name,
        destination: row.destination,
        startDate: row.start_date,
        endDate: row.end_date,
        color: row.color,
        emoji: row.emoji,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        invitedAt: row.created_at,
      })),
    })
  }),
)

router.post(
  '/invites/:tripId/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await acquireSyncLock(client)
      const membership = await client.query(
        `SELECT 1 FROM trip_members
         WHERE trip_id = $1 AND user_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [tripId, userId],
      )
      if (membership.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ error: 'That invitation is no longer available.' })
        return
      }

      await client.query(
        `UPDATE trip_members
         SET status = 'accepted', accepted_at = now()
         WHERE trip_id = $1 AND user_id = $2`,
        [tripId, userId],
      )
      await bumpTripRevisions(client, tripId)
      await client.query('COMMIT')
      res.json({ ok: true, tripId })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)

router.post(
  '/invites/:tripId/decline',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    await pool.query(
      `DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2 AND status = 'pending'`,
      [tripId, userId],
    )
    res.json({ ok: true })
  }),
)

router.get(
  '/trips/:tripId/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    const access = await getTripAccess(pool, userId, tripId)
    if (!access) {
      res.status(404).json({ error: 'Trip not found.' })
      return
    }

    const owner = await getOwner(tripId)
    if (!owner) {
      res.status(404).json({ error: 'Trip not found.' })
      return
    }

    const members = await getMemberRows(tripId, access.role === 'owner')
    res.setHeader('Cache-Control', 'no-store')
    res.json({
      me: access.role,
      owner: {
        id: owner.id,
        email: owner.email,
        displayName: owner.display_name,
        color: owner.color,
      },
      members: members.map((member) => ({
        userId: member.user_id,
        email: member.email,
        displayName: member.display_name,
        color: member.color,
        status: member.status,
        invitedAt: member.created_at,
      })),
    })
  }),
)

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
})

router.post(
  '/trips/:tripId/invite',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    const ownerId = await findTripOwner(pool, tripId)
    if (!ownerId) {
      res.status(404).json({ error: 'Trip not found.' })
      return
    }
    if (ownerId !== userId) {
      res.status(403).json({ error: 'Only the trip owner can invite people.' })
      return
    }

    const parsed = inviteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Enter a valid email.' })
      return
    }

    const targetResult = await pool.query<{ id: string; username: string; display_name: string; color: string }>(
      'SELECT id, email AS username, display_name FROM users WHERE email = $1',
      [parsed.data.email],
    )
    const target = targetResult.rows[0]
    if (!target) {
      res.status(404).json({ error: 'No Jaunt account uses that email yet. Ask them to register first.' })
      return
    }
    if (target.id === ownerId) {
      res.status(400).json({ error: 'You are already on this trip.' })
      return
    }

    const existing = await pool.query(
      'SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, target.id],
    )
    if (existing.rowCount) {
      res.status(409).json({
        error:
          existing.rows[0].status === 'accepted'
            ? 'That person is already on the trip.'
            : 'That person already has a pending invitation.',
      })
      return
    }

    await pool.query(
      `INSERT INTO trip_members (trip_id, user_id, status, invited_by)
       VALUES ($1, $2, 'pending', $3)`,
      [tripId, target.id, userId],
    )

    res.status(201).json({
      ok: true,
      member: {
        userId: target.id,
        email: target.username,
        displayName: target.display_name,
        color: target.color,
        status: 'pending',
        invitedAt: new Date().toISOString(),
      },
    })
  }),
)

router.delete(
  '/trips/:tripId/members/:memberId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    const memberId = String(req.params.memberId ?? '')
    const ownerId = await findTripOwner(pool, tripId)
    if (!ownerId) {
      res.status(404).json({ error: 'Trip not found.' })
      return
    }
    if (ownerId !== userId) {
      res.status(403).json({ error: 'Only the trip owner can remove people.' })
      return
    }
    if (memberId === ownerId) {
      res.status(400).json({ error: 'The owner cannot be removed from the trip.' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await acquireSyncLock(client)
      const membership = await client.query<{ status: string }>(
        'SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2 FOR UPDATE',
        [tripId, memberId],
      )
      if (membership.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ error: 'That invitation was not found.' })
        return
      }

      if (membership.rows[0].status === 'accepted') {
        const activities = await client.query<{ id: string }>(
          'SELECT id FROM activities WHERE trip_id = $1 AND user_id = $2',
          [tripId, ownerId],
        )
        const deletedAt = Date.now()
        for (const activity of activities.rows) {
          await addTombstones(client, [memberId], 'activity', activity.id, deletedAt)
        }
        await addTombstones(client, [memberId], 'trip', tripId, deletedAt)
      }

      await client.query('DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2', [
        tripId,
        memberId,
      ])
      await bumpTripRevisions(client, tripId)
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)

router.post(
  '/trips/:tripId/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id
    const tripId = String(req.params.tripId ?? '')
    const ownerId = await findTripOwner(pool, tripId)
    if (!ownerId) {
      res.status(404).json({ error: 'Trip not found.' })
      return
    }
    if (ownerId === userId) {
      res.status(400).json({ error: 'The owner cannot leave their own trip. Delete it instead.' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await acquireSyncLock(client)
      const membership = await client.query(
        `SELECT 1 FROM trip_members
         WHERE trip_id = $1 AND user_id = $2 AND status = 'accepted'
         FOR UPDATE`,
        [tripId, userId],
      )
      if (membership.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ error: 'Trip not found.' })
        return
      }

      const activities = await client.query<{ id: string }>(
        'SELECT id FROM activities WHERE trip_id = $1 AND user_id = $2',
        [tripId, ownerId],
      )
      const deletedAt = Date.now()
      for (const activity of activities.rows) {
        await addTombstones(client, [userId], 'activity', activity.id, deletedAt)
      }
      await addTombstones(client, [userId], 'trip', tripId, deletedAt)
      await client.query('DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2', [
        tripId,
        userId,
      ])
      await bumpTripRevisions(client, tripId)
      await client.query('COMMIT')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)


export default router
