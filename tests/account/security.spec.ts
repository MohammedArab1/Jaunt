import { expect, test } from '@playwright/test'

const password = 'supersecret123'

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

function sameOriginHeaders(origin: string): Record<string, string> {
  return {
    Origin: origin,
    'X-Requested-With': 'fetch',
  }
}

function activity(id: string, url: string) {
  return {
    id,
    name: 'Security test plan',
    date: '2026-11-20',
    type: 'other' as const,
    url,
    completed: false,
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

test('rejects state-changing requests without the fetch header', async ({ request, baseURL }) => {
  const origin = baseURL ?? 'http://127.0.0.1:8080'
  const response = await request.post('/api/auth/login', {
    headers: { Origin: origin },
    data: { email: 'nobody@example.com', password: 'wrongpassword' },
  })

  expect(response.status()).toBe(403)
  expect(await response.json()).toEqual({ error: 'Missing request header.' })
})

test('rejects cross-origin state-changing requests', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    headers: {
      Origin: 'https://evil.example',
      'X-Requested-With': 'fetch',
    },
    data: { email: 'nobody@example.com', password: 'wrongpassword' },
  })

  expect(response.status()).toBe(403)
  expect(await response.json()).toEqual({ error: 'Cross-origin request blocked.' })
})

test('rejects javascript URLs and accepts https URLs in sync', async ({ request, baseURL }) => {
  const origin = baseURL ?? 'http://127.0.0.1:8080'
  const headers = sameOriginHeaders(origin)
  const email = uniqueEmail('security.url')
  const testId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
  const badId = `bad-url-${testId}`
  const goodId = `good-url-${testId}`

  const register = await request.post('/api/auth/register', {
    headers,
    data: { email, password },
  })
  expect(register.status()).toBe(201)

  const badSync = await request.post('/api/sync', {
    headers,
    data: {
      lastRevision: 0,
      trips: [],
      activities: [activity(badId, 'javascript:alert(1)')],
      packingItems: [],
      attachments: [],
      deletions: [],
    },
  })
  expect(badSync.status()).toBe(400)
  expect(await badSync.json()).toEqual({ error: 'Use an http or https link.' })

  const goodSync = await request.post('/api/sync', {
    headers,
    data: {
      lastRevision: 0,
      trips: [],
      activities: [activity(goodId, 'https://example.com')],
      packingItems: [],
      attachments: [],
      deletions: [],
    },
  })
  expect(goodSync.status()).toBe(200)
  expect((await goodSync.json()).activities).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: goodId, url: 'https://example.com' }),
    ]),
  )
})
