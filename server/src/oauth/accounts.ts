import { randomUUID } from 'node:crypto'
import { pool } from '../db.js'
import { colorForEmail, displayNameFromEmail } from '../auth.js'

export interface OAuthClaims {
  provider: string
  subject: string
  email: string
  name?: string | null
}

export type OAuthLoginResult =
  | { kind: 'signed-in'; userId: string; created: boolean }
  | { kind: 'link-required'; email: string }

export type OAuthLinkResult = 'linked' | 'already-connected' | 'already-linked'

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}

/**
 * Sign in or create an account from verified provider claims.
 *
 * An existing email/password account is never linked automatically. The user
 * must sign in with their password and connect the provider from Settings.
 */
export async function signInWithOAuth(claims: OAuthClaims): Promise<OAuthLoginResult> {
  const email = claims.email.trim().toLowerCase()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      `oauth-sub:${claims.provider}:${claims.subject}`,
    ])
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      `oauth-email:${email}`,
    ])

    const identity = await client.query<{ user_id: string }>(
      'SELECT user_id FROM user_identities WHERE provider = $1 AND subject = $2',
      [claims.provider, claims.subject],
    )
    if (identity.rows[0]) {
      await client.query('COMMIT')
      return { kind: 'signed-in', userId: identity.rows[0].user_id, created: false }
    }

    const existingEmail = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email],
    )
    if (existingEmail.rows[0]) {
      await client.query('ROLLBACK')
      return { kind: 'link-required', email }
    }

    const userId = randomUUID()
    const displayName = claims.name?.trim().slice(0, 60) || displayNameFromEmail(email)
    const color = colorForEmail(email)

    try {
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, color)
         VALUES ($1, $2, NULL, $3, $4)`,
        [userId, email, displayName, color],
      )
    } catch (error) {
      // A password registration can win the race for the same email because it
      // does not take the OAuth advisory lock.
      if (isUniqueViolation(error)) {
        await client.query('ROLLBACK')
        return { kind: 'link-required', email }
      }
      throw error
    }

    await client.query(
      `INSERT INTO user_identities (provider, subject, user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [claims.provider, claims.subject, userId, email],
    )

    await client.query('COMMIT')
    return { kind: 'signed-in', userId, created: true }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

/** Attach a provider identity to an already signed-in account. */
export async function linkOAuthIdentity(
  userId: string,
  claims: OAuthClaims,
): Promise<OAuthLinkResult> {
  const email = claims.email.trim().toLowerCase()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      `oauth-sub:${claims.provider}:${claims.subject}`,
    ])

    const identity = await client.query<{ user_id: string }>(
      'SELECT user_id FROM user_identities WHERE provider = $1 AND subject = $2',
      [claims.provider, claims.subject],
    )
    if (identity.rows[0]) {
      await client.query('COMMIT')
      return identity.rows[0].user_id === userId ? 'already-connected' : 'already-linked'
    }

    const existing = await client.query<{ subject: string }>(
      'SELECT subject FROM user_identities WHERE user_id = $1 AND provider = $2',
      [userId, claims.provider],
    )
    if (existing.rows[0]) {
      await client.query('ROLLBACK')
      return 'already-connected'
    }

    await client.query(
      `INSERT INTO user_identities (provider, subject, user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [claims.provider, claims.subject, userId, email],
    )

    await client.query('COMMIT')
    return 'linked'
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
