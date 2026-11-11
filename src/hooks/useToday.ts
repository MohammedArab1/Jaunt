import { useEffect, useState } from 'react'
import { todayKey } from '@/lib/dates'

export function useToday(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    const refresh = () => {
      const next = todayKey()
      setToday((current) => (current === next ? current : next))
    }

    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return today
}

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), intervalMs)
    window.addEventListener('focus', () => setNow(new Date()))
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}
