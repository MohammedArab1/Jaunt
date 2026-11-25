export function oauthStartUrl(provider: string, mode?: 'link'): string {
  const params = new URLSearchParams()
  if (mode) params.set('mode', mode)
  const query = params.toString()
  return `/api/auth/oauth/${encodeURIComponent(provider)}/start${query ? `?${query}` : ''}`
}
