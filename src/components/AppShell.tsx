import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SideNav } from '@/components/nav/SideNav'
import { BottomNav } from '@/components/nav/BottomNav'
import { SyncBanner } from '@/components/sync/SyncBanner'

export function AppShell() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <div className="relative min-h-dvh">
      <div className="app-ambient" aria-hidden />
      <SideNav />
      <main className="relative z-10 lg:pl-[264px]">
        <SyncBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
