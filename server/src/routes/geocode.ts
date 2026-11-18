import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

const router = Router()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 80,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many city searches. Wait a moment and try again.' },
})

interface OpenMeteoResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  timezone?: string
}

interface CityResult {
  id: string
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

interface CacheEntry {
  expires: number
  results: CityResult[]
}

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 250
const cache = new Map<string, CacheEntry>()

router.get('/', limiter, async (req, res) => {
  const query = String(req.query.q ?? '').trim().slice(0, 80)
  if (query.length < 2) {
    res.json({ results: [] })
    return
  }

  const key = query.toLowerCase()
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', 'public, max-age=600')
    res.json({ results: cached.results })
    return
  }

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', query)
    url.searchParams.set('count', '8')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const response = await fetch(url, { signal: AbortSignal.timeout(6_000) })
    if (!response.ok) {
      throw new Error(`Geocoding service returned ${response.status}`)
    }

    const data = (await response.json()) as { results?: OpenMeteoResult[] }
    const results: CityResult[] = (data.results ?? [])
      .filter(
        (item) =>
          item &&
          typeof item.name === 'string' &&
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude),
      )
      .map((item) => ({
        id: String(item.id),
        name: item.name,
        country: item.country,
        admin1: item.admin1,
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone,
      }))

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, results })

    res.setHeader('Cache-Control', 'public, max-age=600')
    res.json({ results })
  } catch (error) {
    console.error('City search failed:', error)
    res.status(502).json({
      error: 'City search is unavailable right now.',
      results: [],
    })
  }
})

export default router
