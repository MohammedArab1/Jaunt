import { Router, type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as client from 'openid-client'
import { config } from '../config.js'
import { pool } from '../db.js'
import { cleanupExpiredSessions, getSessionUser, startSession } from '../auth.js'
import {
  linkOAuthIdentity,
  signInWithOAuth,
  type OAuthClaims,
} from '../oauth/accounts.js'
import {
  oauthRedirectUri,
  oidcConfiguration,
  providerById,
  type OAuthProvider,
} from '../oauth/providers.js'

const router = Router()

const OAUTH_COOKIE = 'jaunt_oauth_state'
const OAUTH_COOKIE_PATH = '/api/auth/oauth'
const TRANSACTION_TTL_MS = 10 * 60 * 1000

type OAuthMode = 'login' | 'link'

interface TransactionRow {
  mode: OAuthMode
  user_id: string | null
  nonce: string
  code_verifier: string
}

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Give it a few minutes and try again.' },
})

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: OAUTH_COOKIE_PATH,
  }
}

function redirectWithOAuthResult(
  res: Response,
  mode: OAuthMode,
  code: string,
  provider?: OAuthProvider,
): void {
  const params = new URLSearchParams({ oauth: code })
  if (provider) params.set('provider', provider.id)
  res.redirect(`${mode === 'link' ? '/settings' : '/'}?${params.toString()}`)
}

function startMode(req: Request): OAuthMode {
  return req.query.mode === 'link' ? 'link' : 'login'
}

router.get(
  '/:provider/start',
  oauthLimiter,
  asyncHandler(async (req, res) => {
    const mode = startMode(req)
    const provider = providerById(String(req.params.provider ?? ''))
    if (!provider) {
      redirectWithOAuthResult(res, mode, 'unavailable')
      return
    }

    let userId: string | null = null
    if (mode === 'link') {
      const user = await getSessionUser(req)
      if (!user) {
        redirectWithOAuthResult(res, 'login', 'sign-in-required', provider)
        return
      }
      userId = user.id
    }

    const state = client.randomState()
    const nonce = client.randomNonce()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)

    let oidc
    try {
      oidc = await oidcConfiguration(provider)
    } catch (error) {
      console.error(`Could not discover OIDC configuration for ${provider.id}:`, error)
      redirectWithOAuthResult(res, mode, 'unavailable', provider)
      return
    }

    await pool.query('DELETE FROM oauth_transactions WHERE expires_at < now()')
    await pool.query(
      `INSERT INTO oauth_transactions (state, provider, mode, user_id, nonce, code_verifier, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        state,
        provider.id,
        mode,
        userId,
        nonce,
        codeVerifier,
        new Date(Date.now() + TRANSACTION_TTL_MS),
      ],
    )

    res.cookie(OAUTH_COOKIE, state, {
      ...stateCookieOptions(),
      maxAge: TRANSACTION_TTL_MS,
    })

    const authorizationUrl = client.buildAuthorizationUrl(oidc, {
      redirect_uri: oauthRedirectUri(provider),
      scope: provider.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      // Linking is explicit; let the user pick which provider account to attach.
      ...(mode === 'link' ? { prompt: 'select_account' } : {}),
    })

    res.redirect(authorizationUrl.href)
  }),
)

router.get(
  '/:provider/callback',
  oauthLimiter,
  asyncHandler(async (req, res) => {
    const provider = providerById(String(req.params.provider ?? ''))
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const cookieState = req.cookies?.[OAUTH_COOKIE] as string | undefined

    res.clearCookie(OAUTH_COOKIE, stateCookieOptions())

    if (!provider) {
      redirectWithOAuthResult(res, 'login', 'unavailable')
      return
    }
    if (!state || !cookieState || state !== cookieState) {
      redirectWithOAuthResult(res, 'login', 'failed', provider)
      return
    }

    const transactionResult = await pool.query<TransactionRow>(
      `DELETE FROM oauth_transactions
       WHERE state = $1 AND provider = $2 AND expires_at > now()
       RETURNING mode, user_id, nonce, code_verifier`,
      [state, provider.id],
    )
    const transaction = transactionResult.rows[0]
    if (!transaction) {
      redirectWithOAuthResult(res, 'login', 'expired', provider)
      return
    }

    if (transaction.mode === 'link') {
      const user = await getSessionUser(req)
      if (!user || !transaction.user_id || user.id !== transaction.user_id) {
        redirectWithOAuthResult(res, 'login', 'sign-in-required', provider)
        return
      }
    }

    let oauthClaims: OAuthClaims
    try {
      const oidc = await oidcConfiguration(provider)
      const currentUrl = new URL(req.originalUrl, config.publicUrl)
      const tokens = await client.authorizationCodeGrant(oidc, currentUrl, {
        pkceCodeVerifier: transaction.code_verifier,
        expectedState: state,
        expectedNonce: transaction.nonce,
      })
      const claims = tokens.claims()

      if (!claims?.sub || typeof claims.email !== 'string' || !claims.email) {
        redirectWithOAuthResult(res, transaction.mode, 'failed', provider)
        return
      }
      if (provider.requireVerifiedEmail && claims.email_verified !== true) {
        redirectWithOAuthResult(res, transaction.mode, 'unverified', provider)
        return
      }

      oauthClaims = {
        provider: provider.id,
        subject: claims.sub,
        email: claims.email,
        name: typeof claims.name === 'string' ? claims.name : null,
      }
    } catch (error) {
      console.error(`OIDC callback failed for ${provider.id}:`, error)
      redirectWithOAuthResult(res, transaction.mode, 'failed', provider)
      return
    }

    if (transaction.mode === 'link') {
      if (!transaction.user_id) {
        redirectWithOAuthResult(res, 'login', 'sign-in-required', provider)
        return
      }

      const result = await linkOAuthIdentity(transaction.user_id, oauthClaims)
      const code =
        result === 'linked'
          ? 'connected'
          : result === 'already-linked'
            ? 'already-linked'
            : 'already-connected'
      redirectWithOAuthResult(res, 'link', code, provider)
      return
    }

    const result = await signInWithOAuth(oauthClaims)
    if (result.kind === 'link-required') {
      redirectWithOAuthResult(res, 'login', 'link-required', provider)
      return
    }

    await startSession(res, result.userId)
    await cleanupExpiredSessions()
    res.redirect('/')
  }),
)

export default router
