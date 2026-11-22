import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db.js'
import {
  cleanupExpiredSessions,
  clearSessionCookie,
  colorForEmail,
  deleteCurrentSession,
  displayNameFromEmail,
  hashPassword,
  type AuthUser,
  currentUser,
  optionalAuth,
  requireAuth,
  publicUser,
  startSession,
  verifyPassword,
} from '../auth.js'
import {
  acquireSyncLock,
  addTombstones,
  bumpTripRevisions,
  getAcceptedMemberIds,
  getTripParticipantIds,
} from '../tripAccess.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Give it a few minutes and try again.' },
})

// Registration is counted whether it succeeds or fails: otherwise an attacker
// can create unlimited accounts (bcrypt CPU, database rows, and storage).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 35,
  skipSuccessfulRequests: false,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this address. Try again later.' },
})

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128, 'Password is too long.'),
})

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(128, 'Password is too long.'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
})

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password.').max(128, 'Password is too long.'),
})

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the details and try again.'
}

function passwordFitsBcrypt(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= 72
}

interface UserRow {
  id: string
  email: string
  password_hash: string
  display_name: string
  color: string
}

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) })
      return
    }

    const { email, password } = parsed.data
    if (!passwordFitsBcrypt(password)) {
      res.status(400).json({ error: 'Password must be 72 bytes or fewer.' })
      return
    }

    const passwordHash = await hashPassword(password)
    const userId = randomUUID()
    const displayName = displayNameFromEmail(email)
    const color = colorForEmail(email)

    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (id, email, password_hash, display_name, color)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, display_name, color`,
        [userId, email, passwordHash, displayName, color],
      )

      const user: AuthUser = publicUser(result.rows[0])
      await startSession(res, user.id)
      await cleanupExpiredSessions()
      res.status(201).json({ user })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(409).json({ error: 'Could not create an account with those details. Try signing in instead.' })
        return
      }
      throw error
    }
  }),
)

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) })
      return
    }

    const { email, password } = parsed.data
    const result = await pool.query<UserRow>(
      `SELECT id, email, password_hash, display_name, color
       FROM users WHERE email = $1`,
      [email],
    )

    const row = result.rows[0]
    if (!row || !passwordFitsBcrypt(password) || !(await verifyPassword(password, row.password_hash))) {
      res.status(401).json({ error: 'Email or password is incorrect.' })
      return
    }

    await startSession(res, row.id)
    await cleanupExpiredSessions()
    res.json({ user: publicUser(row) })
  }),
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await deleteCurrentSession(req)
    clearSessionCookie(res)
    res.json({ ok: true })
  }),
)

router.delete(
  '/account',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = deleteAccountSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) })
      return
    }

    const userId = currentUser(req).id
    if (!passwordFitsBcrypt(parsed.data.password)) {
      res.status(400).json({ error: 'Password is too long.' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await acquireSyncLock(client)

      const passwordResult = await client.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId],
      )
      const passwordRow = passwordResult.rows[0]
      if (!passwordRow || !(await verifyPassword(parsed.data.password, passwordRow.password_hash))) {
        await client.query('ROLLBACK')
        res.status(400).json({ error: 'Password is incorrect.' })
        return
      }

      const deletedAt = Date.now()
      const ownedTrips = await client.query<{ id: string }>(
        'SELECT id FROM trips WHERE user_id = $1',
        [userId],
      )

      // Remove the account from shared trips and leave tombstones so other
      // members' offline caches drop the owner's trips and files.
      for (const trip of ownedTrips.rows) {
        const memberIds = await getAcceptedMemberIds(client, trip.id)
        if (memberIds.length > 0) {
          const activities = await client.query<{ id: string }>(
            'SELECT id FROM activities WHERE trip_id = $1',
            [trip.id],
          )
          const attachments = await client.query<{ id: string }>(
            `SELECT id FROM attachments
             WHERE activity_id IN (SELECT id FROM activities WHERE trip_id = $1)`,
            [trip.id],
          )
          const packingItems = await client.query<{ id: string }>(
            'SELECT id FROM packing_items WHERE trip_id = $1',
            [trip.id],
          )

          for (const memberId of memberIds) {
            await addTombstones(client, [memberId], 'trip', trip.id, deletedAt)
            for (const activity of activities.rows) {
              await addTombstones(client, [memberId], 'activity', activity.id, deletedAt)
            }
            for (const attachment of attachments.rows) {
              await addTombstones(client, [memberId], 'attachment', attachment.id, deletedAt)
            }
            for (const item of packingItems.rows) {
              await addTombstones(client, [memberId], 'packing', item.id, deletedAt)
            }
          }
        }

        await client.query('DELETE FROM trip_members WHERE trip_id = $1', [trip.id])
      }

      const memberTrips = await client.query<{ trip_id: string }>(
        `SELECT tm.trip_id
         FROM trip_members tm
         JOIN trips t ON t.id = tm.trip_id
         WHERE tm.user_id = $1 AND t.user_id <> $1`,
        [userId],
      )

      for (const tripId of [...new Set(memberTrips.rows.map((row) => row.trip_id))]) {
        const participants = await getTripParticipantIds(client, tripId)
        const packingItems = await client.query<{ id: string }>(
          'SELECT id FROM packing_items WHERE trip_id = $1 AND owner_user_id = $2',
          [tripId, userId],
        )
        for (const item of packingItems.rows) {
          await addTombstones(client, participants, 'packing', item.id, deletedAt)
        }
        await bumpTripRevisions(client, tripId)
      }

      await client.query('DELETE FROM users WHERE id = $1', [userId])
      await client.query('COMMIT')
      clearSessionCookie(res)
      res.setHeader('Cache-Control', 'no-store')
      res.json({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }),
)

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name.').max(60, 'That name is too long.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid color.'),
})

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) })
      return
    }

    const result = await pool.query<UserRow>(
      `UPDATE users
       SET display_name = $2, color = $3
       WHERE id = $1
       RETURNING id, email, password_hash, display_name, color`,
      [currentUser(req).id, parsed.data.displayName, parsed.data.color],
    )

    res.json({ user: publicUser(result.rows[0]) })
  }),
)

router.patch(
  '/password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = passwordChangeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: firstIssue(parsed.error) })
      return
    }

    const { currentPassword, newPassword } = parsed.data
    if (!passwordFitsBcrypt(currentPassword) || !passwordFitsBcrypt(newPassword)) {
      res.status(400).json({ error: 'Passwords must be 72 bytes or fewer.' })
      return
    }

    const userId = currentUser(req).id
    const result = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
    )
    const row = result.rows[0]
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      res.status(400).json({ error: 'Current password is incorrect.' })
      return
    }

    if (await verifyPassword(newPassword, row.password_hash)) {
      res.status(400).json({ error: 'Choose a password that is different from your current one.' })
      return
    }

    const passwordHash = await hashPassword(newPassword)
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash])

    // Changing the password signs out every other device. This session stays valid.
    if (req.sessionTokenHash) {
      await pool.query(
        'DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2',
        [userId, req.sessionTokenHash],
      )
    }

    await cleanupExpiredSessions()
    res.setHeader('Cache-Control', 'no-store')
    res.json({ ok: true })
  }),
)

router.get(
  '/me',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ user: req.user ?? null })
  }),
)

export default router
