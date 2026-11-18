import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getWeather, WeatherError } from '../weather.js'

const router = Router()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many weather requests. Wait a moment and try again.' },
})

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

router.get('/', limiter, async (req, res) => {
  const name = String(req.query.name ?? '').trim().slice(0, 200)
  const start = String(req.query.start ?? '')
  const end = String(req.query.end ?? '')
  const timezone = String(req.query.timezone ?? '').trim().slice(0, 100)
  const latitude = optionalNumber(req.query.latitude)
  const longitude = optionalNumber(req.query.longitude)

  if (
    (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    res.status(400).json({ error: 'Invalid weather coordinates.' })
    return
  }

  try {
    const data = await getWeather({
      name: name || undefined,
      latitude,
      longitude,
      timezone: timezone || undefined,
      start,
      end,
    })
    res.setHeader('Cache-Control', 'no-store')
    res.json(data)
  } catch (error) {
    if (error instanceof WeatherError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    console.error('Weather request failed:', error)
    res.status(502).json({ error: 'Weather is unavailable right now.' })
  }
})

export default router
