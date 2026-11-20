import type {
  AuthUser,
  GeocodeResponse,
  PublicTripPayload,
  SyncRequest,
  SyncResponse,
  TripInvite,
  TripMember,
  TripMembersPayload,
  TripSharePayload,
  WeatherLocation,
} from '@/types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class ApiUnavailableError extends Error {
  constructor(message = 'Could not reach the Jaunt server.') {
    super(message)
    this.name = 'ApiUnavailableError'
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  timeoutMs?: number
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  let payload: BodyInit | undefined

  // Cross-origin JavaScript cannot set this header without a CORS preflight.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    headers['X-Requested-With'] = 'fetch'
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ApiUnavailableError('The server took too long to respond.')
    }
    throw new ApiUnavailableError()
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Keep the fallback message.
    }
    throw new ApiError(message, response.status)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiUnavailableError('The server returned an unexpected response.')
  }
}

export const api = {
  auth: {
    me: (timeoutMs = 4500) => request<{ user: AuthUser | null }>('/api/auth/me', { timeoutMs }),
    login: (email: string, password: string) =>
      request<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    register: (email: string, password: string) =>
      request<{ user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      }),
    logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    updateProfile: (displayName: string, color: string) =>
      request<{ user: AuthUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: { displayName, color },
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: true }>('/api/auth/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      }),
  },

  geocode: (query: string) =>
    request<GeocodeResponse>(`/api/geocode?q=${encodeURIComponent(query)}`, {
      timeoutMs: 8_000,
    }),

  weather: (params: {
    name?: string
    latitude?: number
    longitude?: number
    timezone?: string
    start: string
    end: string
  }) => {
    const query = new URLSearchParams()
    if (params.name) query.set('name', params.name)
    if (params.latitude !== undefined) query.set('latitude', String(params.latitude))
    if (params.longitude !== undefined) query.set('longitude', String(params.longitude))
    if (params.timezone) query.set('timezone', params.timezone)
    query.set('start', params.start)
    query.set('end', params.end)
    return request<WeatherLocation>(`/api/weather?${query.toString()}`, { timeoutMs: 25_000 })
  },

  sync: (payload: SyncRequest) =>
    request<SyncResponse>('/api/sync', {
      method: 'POST',
      body: payload,
      timeoutMs: 60_000,
    }),

  invites: {
    list: () => request<{ invites: TripInvite[] }>('/api/invites'),
    accept: (tripId: string) =>
      request<{ ok: true; tripId: string }>(`/api/invites/${encodeURIComponent(tripId)}/accept`, {
        method: 'POST',
      }),
    decline: (tripId: string) =>
      request<{ ok: true }>(`/api/invites/${encodeURIComponent(tripId)}/decline`, {
        method: 'POST',
      }),
  },

  trips: {
    members: (tripId: string) =>
      request<TripMembersPayload>(`/api/trips/${encodeURIComponent(tripId)}/members`),
    invite: (tripId: string, email: string) =>
      request<{ ok: true; member: TripMember }>(`/api/trips/${encodeURIComponent(tripId)}/invite`, {
        method: 'POST',
        body: { email },
      }),
    removeMember: (tripId: string, memberId: string) =>
      request<{ ok: true }>(
        `/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' },
      ),
    leave: (tripId: string) =>
      request<{ ok: true }>(`/api/trips/${encodeURIComponent(tripId)}/leave`, {
        method: 'POST',
      }),
    share: (tripId: string) =>
      request<TripSharePayload>(`/api/trips/${encodeURIComponent(tripId)}/share`),
    createShare: (tripId: string) =>
      request<TripSharePayload>(`/api/trips/${encodeURIComponent(tripId)}/share`, {
        method: 'POST',
      }),
    deleteShare: (tripId: string) =>
      request<{ ok: true }>(`/api/trips/${encodeURIComponent(tripId)}/share`, {
        method: 'DELETE',
      }),
  },

  publicTrip: (token: string) =>
    request<PublicTripPayload>(`/api/public/trips/${encodeURIComponent(token)}`),

  async uploadAttachment(id: string, blob: Blob, mimeType: string): Promise<void> {
    let response: Response
    try {
      response = await fetch(`/api/attachments/${encodeURIComponent(id)}/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'X-Requested-With': 'fetch',
        },
        body: blob,
        credentials: 'same-origin',
      })
    } catch {
      throw new ApiUnavailableError()
    }

    if (!response.ok) {
      let message = `Could not upload that file (${response.status}).`
      try {
        const data = (await response.json()) as { error?: string }
        if (data.error) message = data.error
      } catch {
        // Keep fallback.
      }
      throw new ApiError(message, response.status)
    }
  },

  async downloadAttachment(id: string): Promise<Blob> {
    let response: Response
    try {
      response = await fetch(`/api/attachments/${encodeURIComponent(id)}/file`, {
        credentials: 'same-origin',
      })
    } catch {
      throw new ApiUnavailableError()
    }

    if (!response.ok) {
      throw new ApiError('Could not download that file.', response.status)
    }

    return response.blob()
  },
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiUnavailableError || (typeof navigator !== 'undefined' && !navigator.onLine)
}
