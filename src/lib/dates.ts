import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Activity } from '@/types'

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

export function sortActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
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

export type ActivityPhase = 'now' | 'upcoming' | 'later' | 'anytime'

export interface UpNext {
  activity: Activity
  phase: ActivityPhase
}

export function getUpNext(activities: Activity[], now = new Date()): UpNext | null {
  const pending = activities.filter((activity) => !activity.completed)
  if (pending.length === 0) return null

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const ongoing = pending.find(
    (activity) =>
      activity.startTime &&
      timeToMinutes(activity.startTime) <= nowMinutes &&
      activity.endTime &&
      timeToMinutes(activity.endTime) > nowMinutes,
  )
  if (ongoing) return { activity: ongoing, phase: 'now' }

  const upcoming = pending
    .filter((activity) => activity.startTime && timeToMinutes(activity.startTime) > nowMinutes)
    .sort((a, b) => timeToMinutes(a.startTime ?? '') - timeToMinutes(b.startTime ?? ''))[0]
  if (upcoming) return { activity: upcoming, phase: 'upcoming' }

  const anytime = pending.find((activity) => !activity.startTime)
  if (anytime) return { activity: anytime, phase: 'anytime' }

  return { activity: pending[0], phase: 'later' }
}

export function phaseLabel(upNext: UpNext, now = new Date()): string {
  if (upNext.phase === 'now') return 'Happening now'
  if (upNext.phase === 'anytime') return 'Any time today'
  if (upNext.phase === 'later') return 'Still on the list'
  return countdownLabel(upNext.activity.startTime ?? '', now)
}
