import { Router, type NextFunction, type Request, type Response } from 'express'
import { pool } from '../db.js'

const router = Router()

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next)
  }
}

interface PublicTripRow {
  id: string
  name: string
  destination: string | null
  start_date: string
  end_date: string
  color: string
  emoji: string
  owner_name: string
}

interface PublicActivityRow {
  id: string
  name: string
  date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  time_slot: string | null
  location: string | null
  type: string
  completed: boolean
  sort_order: number
  created_at: string
}

function notFound(res: Response): void {
  res.status(404).json({ error: 'This shared itinerary is no longer available.' })
}

router.get(
  '/trips/:token',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token ?? '')
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) {
      notFound(res)
      return
    }

    const tripResult = await pool.query<PublicTripRow>(
      `SELECT t.id, t.name, t.destination,
              t.start_date::text AS start_date, t.end_date::text AS end_date,
              t.color, t.emoji, u.display_name AS owner_name
       FROM trips t
       JOIN users u ON u.id = t.user_id
       WHERE t.share_token = $1
       LIMIT 1`,
      [token],
    )

    const trip = tripResult.rows[0]
    if (!trip) {
      notFound(res)
      return
    }

    const activitiesResult = await pool.query<PublicActivityRow>(
      `SELECT id, name, date::text AS date, end_date::text AS end_date,
              start_time, end_time, time_slot, location, type, completed,
              sort_order, created_at
       FROM activities
       WHERE trip_id = $1
       ORDER BY date ASC, sort_order ASC, created_at ASC`,
      [trip.id],
    )

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.json({
      trip: {
        name: trip.name,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        color: trip.color,
        emoji: trip.emoji,
        ownerName: trip.owner_name,
      },
      activities: activitiesResult.rows.map((activity) => ({
        id: activity.id,
        name: activity.name,
        date: activity.date,
        endDate: activity.end_date,
        startTime: activity.start_time,
        endTime: activity.end_time,
        timeSlot: activity.time_slot,
        location: activity.location,
        type: activity.type,
        completed: activity.completed,
        sortOrder: activity.sort_order,
        createdAt: Number(activity.created_at),
      })),
    })
  }),
)

export default router
