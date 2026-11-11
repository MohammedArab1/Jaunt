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

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Give it a few minutes and try again.' },
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
  authLimiter,
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
        res.status(409).json({ error: 'An account with that email already exists.' })
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

router.get(
  '/me',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ user: req.user ?? null })
  }),
)

export default router
