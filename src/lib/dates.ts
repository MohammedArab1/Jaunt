import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Activity, TimeSlot } from '@/types'

const DAY_KEY = 'yyyy-MM-dd'

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function dateKey(date: Date): string {
  return format(date, DAY_KEY)
}

export function todayKey(date = new Date()): string {
  return dateKey(date)
}

export function parseDayKey(key: string): Date {
  return parseISO(key)
}

export function formatDay(key: string, pattern: string): string {
  return format(parseDayKey(key), pattern)
}

export function formatTimeValue(time?: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time
  return timeFormatter.format(new Date(2000, 0, 1, hours, minutes))
}

export function formatTimeRange(startTime?: string, endTime?: string): string {
  if (startTime && endTime) return `${formatTimeValue(startTime)} – ${formatTimeValue(endTime)}`
  if (startTime) return formatTimeValue(startTime)
  if (endTime) return `Until ${formatTimeValue(endTime)}`
  return 'Any time'
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

export interface TimeSlotMeta {
  label: string
  rangeLabel: string
  start: number
  end: number
  sortRank: number
}

export const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'morning',
  'afternoon',
  'evening',
]

export const TIME_SLOT_META: Record<TimeSlot, TimeSlotMeta> = {
  'early-morning': {
    label: 'Early morning',
    rangeLabel: '12:00–4:59 AM',
    start: 0,
    end: 4 * 60 + 59,
    sortRank: 0,
  },
  morning: {
    label: 'Morning',
    rangeLabel: '5:00 AM–12:00 PM',
    start: 5 * 60,
    end: 12 * 60,
    sortRank: 5 * 60,
  },
  afternoon: {
    label: 'Afternoon',
    rangeLabel: '12:01–6:00 PM',
    start: 12 * 60 + 1,
    end: 18 * 60,
    sortRank: 12 * 60 + 1,
  },
  evening: {
    label: 'Evening',
    rangeLabel: '6:01–11:59 PM',
    start: 18 * 60 + 1,
    end: 24 * 60 - 1,
    sortRank: 18 * 60 + 1,
  },
}

export function formatTimeSlot(slot: TimeSlot): string {
  return TIME_SLOT_META[slot]?.label ?? 'Any time'
}

type ActivityDates = { date: string; endDate?: string | null }
type ActivityTiming = {
  startTime?: string | null
  endTime?: string | null
  timeSlot?: TimeSlot | null
}

export function activityEndDate(activity: ActivityDates): string {
  return activity.endDate && activity.endDate > activity.date ? activity.endDate : activity.date
}

export function activitySpansMultipleDays(activity: ActivityDates): boolean {
  return activityEndDate(activity) !== activity.date
}

export function occursOn(activity: ActivityDates, date: string): boolean {
  return activity.date <= date && activityEndDate(activity) >= date
}

export function overlapsRange(activity: ActivityDates, start: string, end: string): boolean {
  return activity.date <= end && activityEndDate(activity) >= start
}

export function activityScheduleLabel(activity: ActivityTiming): string {
  if (activity.timeSlot) return formatTimeSlot(activity.timeSlot)
  return formatTimeRange(activity.startTime ?? undefined, activity.endTime ?? undefined)
}

export function activityDateRangeLabel(activity: ActivityDates): string | null {
  const end = activityEndDate(activity)
  if (end === activity.date) return null
  return compactDateRange(activity.date, end)
}

export function activitySpanPosition(
  activity: ActivityDates,
  date: string,
): { day: number; total: number } | null {
  const end = activityEndDate(activity)
  if (end === activity.date) return null
  const total = differenceInCalendarDays(parseISO(end), parseISO(activity.date)) + 1
  const day = differenceInCalendarDays(parseISO(date), parseISO(activity.date)) + 1
  if (day < 1 || day > total) return null
  return { day, total }
}

export function activityTimeRank(activity: Pick<ActivityTiming, 'startTime' | 'timeSlot'>): number {
  if (activity.startTime) return timeToMinutes(activity.startTime)
  if (activity.timeSlot) return TIME_SLOT_META[activity.timeSlot]?.sortRank ?? Number.MAX_SAFE_INTEGER
  return Number.MAX_SAFE_INTEGER
}

export function isTimeOrdered(activities: Activity[]): boolean {
  for (let index = 1; index < activities.length; index += 1) {
    if (activityTimeRank(activities[index - 1]) > activityTimeRank(activities[index])) {
      return false
    }
  }
  return true
}

export function compareActivitiesByTime(a: Activity, b: Activity): number {
  return (
    activityTimeRank(a) - activityTimeRank(b) ||
    a.sortOrder - b.sortOrder ||
    a.createdAt - b.createdAt
  )
}

export function sortActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

export function sortActivitiesByTime(activities: Activity[]): Activity[] {
  return [...activities].sort(compareActivitiesByTime)
}

export function dateRangeLabel(start: string, end: string): string {
  if (start === end) return format(parseISO(start), 'MMM d, yyyy')
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${format(startDate, 'MMM d')} – ${format(endDate, 'd, yyyy')}`
    }
    return `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
  }
  return `${format(startDate, 'MMM d, yyyy')} – ${format(endDate, 'MMM d, yyyy')}`
}

export function compactDateRange(start: string, end: string): string {
  if (start === end) return format(parseISO(start), 'MMM d')
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${format(startDate, 'MMM d')}–${format(endDate, 'd')}`
  }
  return `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`
}

export function daysUntil(key: string, from = new Date()): number {
  return differenceInCalendarDays(parseDayKey(key), from)
}

export function countdownLabel(startTime: string, now = new Date()): string {
  const diff = timeToMinutes(startTime) - (now.getHours() * 60 + now.getMinutes())
  if (diff <= 0) return 'Starting soon'
  if (diff < 60) return `In ${diff} min`
  const hours = Math.floor(diff / 60)
  const minutes = diff % 60
  return minutes ? `In ${hours}h ${minutes}m` : `In ${hours}h`
}

export function tripCountdownLabel(startDate: string, endDate: string, today: string): string {
  if (today > endDate) return 'Past trip'
  if (today >= startDate) {
    const day = differenceInCalendarDays(parseDayKey(today), parseDayKey(startDate)) + 1
    const total = differenceInCalendarDays(parseDayKey(endDate), parseDayKey(startDate)) + 1
    return total === 1 ? 'Today' : `Day ${day} of ${total}`
  }
  const days = differenceInCalendarDays(parseDayKey(startDate), parseDayKey(today))
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

export function eachDayKey(start: string, end: string, cap = 180): string[] {
  const result: string[] = []
  let cursor = parseISO(start)
  const endDate = parseISO(end)
  while (cursor <= endDate && result.length < cap) {
    result.push(format(cursor, DAY_KEY))
    cursor = addDays(cursor, 1)
  }
  return result
}

export type ActivityPhase = 'now' | 'upcoming' | 'later' | 'anytime' | 'slot'

export interface UpNext {
  activity: Activity
  phase: ActivityPhase
}

export function getUpNext(activities: Activity[], now = new Date()): UpNext | null {
  const pending = activities.filter((activity) => !activity.completed)
  if (pending.length === 0) return null

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const today = dateKey(now)

  const ongoingTimed = pending.find(
    (activity) =>
      activity.startTime &&
      timeToMinutes(activity.startTime) <= nowMinutes &&
      activity.endTime &&
      timeToMinutes(activity.endTime) > nowMinutes,
  )
  if (ongoingTimed) return { activity: ongoingTimed, phase: 'now' }

  const ongoingMultiDay = pending.find(
    (activity) => activity.date < today && activityEndDate(activity) >= today,
  )
  if (ongoingMultiDay) return { activity: ongoingMultiDay, phase: 'now' }

  type Candidate = { activity: Activity; rank: number; phase: ActivityPhase }
  const candidates: Candidate[] = []

  for (const activity of pending) {
    if (activity.startTime) {
      const start = timeToMinutes(activity.startTime)
      if (start >= nowMinutes) candidates.push({ activity, rank: start, phase: 'upcoming' })
      continue
    }

    if (activity.timeSlot) {
      const slot = TIME_SLOT_META[activity.timeSlot]
      if (!slot) continue
      if (nowMinutes >= slot.start && nowMinutes <= slot.end) {
        candidates.push({ activity, rank: nowMinutes, phase: 'slot' })
      } else if (nowMinutes < slot.start) {
        candidates.push({ activity, rank: slot.start, phase: 'slot' })
      }
    }
  }

  const next = candidates.sort((a, b) => a.rank - b.rank || a.activity.sortOrder - b.activity.sortOrder)[0]
  if (next) return { activity: next.activity, phase: next.phase }

  const anytime = pending.find((activity) => !activity.startTime && !activity.timeSlot)
  if (anytime) return { activity: anytime, phase: 'anytime' }

  return { activity: pending[0], phase: 'later' }
}

export function phaseLabel(upNext: UpNext, now = new Date()): string {
  if (upNext.phase === 'slot' && upNext.activity.timeSlot) {
    return formatTimeSlot(upNext.activity.timeSlot)
  }
  if (upNext.phase === 'now') return 'Happening now'
  if (upNext.phase === 'anytime') return 'Any time today'
  if (upNext.phase === 'later') return 'Still on the list'
  return countdownLabel(upNext.activity.startTime ?? '', now)
}
