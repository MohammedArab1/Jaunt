import { createHash, randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { NextFunction, Request, Response } from 'express'
import { pool } from './db.js'
import { config, SESSION_COOKIE } from './config.js'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  color: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      sessionTokenHash?: string
    }
  }
}

interface SessionRow {
  id: string
  email: string
  display_name: string
  color: string
}

const NAME_COLORS = ['#FF6B4A', '#FFD166', '#4ADE97', '#5EC8FF', '#A98BFF', '#FF5C8A']

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  }
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0]?.split('+')[0] ?? 'friend'
  const name = localPart
    .replace(/\d{3,}/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

  if (!name) return 'Friend'
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function colorForEmail(email: string): string {
  let hash = 0
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return NAME_COLORS[hash % NAME_COLORS.length]
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function publicUser(row: SessionRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    color: row.color,
  }
}

export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = tokenHash(token)
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000)

  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, hash, expiresAt],
  )

  res.cookie(SESSION_COOKIE, token, cookieOptions())
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  })
}

export async function deleteCurrentSession(req: Request): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined
  if (!token) return
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)])
}

export async function getSessionUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined
  if (!token) return null

  const hash = tokenHash(token)
  const result = await pool.query<SessionRow>(
    `SELECT u.id, u.email, u.display_name, u.color
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hash],
  )

  const row = result.rows[0]
  if (!row) return null

  req.sessionTokenHash = hash
  return publicUser(row)
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = (await getSessionUser(req)) ?? undefined
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getSessionUser(req)
    if (!user) {
      res.status(401).json({ error: 'Please sign in to continue.' })
      return
    }
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('Authentication middleware missing')
  return req.user
}

export async function cleanupExpiredSessions(): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE expires_at < now()')
}
