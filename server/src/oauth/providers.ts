import * as client from 'openid-client'
import { config } from '../config.js'

export interface OAuthProvider {
  id: string
  label: string
  issuer: string
  clientId: string
  clientSecret: string
  scopes: string
  requireVerifiedEmail: boolean
}

/*
 * To add another OIDC provider, add an entry here, expose its client ID and
 * secret through config.ts, and register the callback URL with the provider:
 *   <PUBLIC_URL>/api/auth/oauth/<id>/callback
 *
 * The routes, transaction storage, account linking, and frontend buttons are
 * provider-agnostic.
 */
const providers: OAuthProvider[] = [
  {
    id: 'google',
    label: 'Google',
    issuer: config.oauth.google.issuer,
    clientId: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
    scopes: 'openid email profile',
    requireVerifiedEmail: true,
  },
]

export function enabledProviders(): OAuthProvider[] {
  return providers.filter(
    (provider) => Boolean(provider.clientId && provider.clientSecret && config.publicUrl),
  )
}

export function providerById(id: string): OAuthProvider | undefined {
  return enabledProviders().find((provider) => provider.id === id)
}

export function publicProviders(): Array<{ id: string; label: string }> {
  return enabledProviders().map(({ id, label }) => ({ id, label }))
}

export function oauthRedirectUri(provider: OAuthProvider): string {
  return new URL(`/api/auth/oauth/${provider.id}/callback`, config.publicUrl).href
}

const configurations = new Map<string, Promise<Awaited<ReturnType<typeof client.discovery>>>>()

export function oidcConfiguration(
  provider: OAuthProvider,
): Promise<Awaited<ReturnType<typeof client.discovery>>> {
  const cached = configurations.get(provider.id)
  if (cached) return cached

  const pending = client
    .discovery(
      new URL(provider.issuer),
      provider.clientId,
      provider.clientSecret,
      undefined,
      // Local mock providers can run over plain HTTP. Production providers
      // should always use HTTPS.
      !config.isProduction && provider.issuer.startsWith('http://')
        ? { execute: [client.allowInsecureRequests] }
        : undefined,
    )
    .catch((error) => {
      configurations.delete(provider.id)
      throw error
    })

  configurations.set(provider.id, pending)
  return pending
}

const google = providers[0]
if (
  google &&
  (google.clientId || google.clientSecret) &&
  !enabledProviders().some((provider) => provider.id === 'google')
) {
  console.warn(
    'Google sign-in is disabled: set PUBLIC_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET together.',
  )
}
