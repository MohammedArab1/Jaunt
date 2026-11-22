import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { ActivityViewsProvider } from '@/context/ActivityViews'
import { AppShell } from '@/components/AppShell'
import { Splash } from '@/components/Splash'
import { UpdateBanner } from '@/components/UpdateBanner'
import { Onboarding } from '@/pages/Onboarding'
import { AuthScreen } from '@/pages/AuthScreen'
import { TodayPage } from '@/pages/TodayPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { SearchPage } from '@/pages/SearchPage'
import { TripsPage } from '@/pages/TripsPage'
import { TripDetailPage } from '@/pages/TripDetailPage'
import { PackingListPage } from '@/pages/PackingListPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PublicTripPage } from '@/pages/PublicTripPage'
import { PrivacyPage } from '@/pages/PrivacyPage'

function AppRoutes() {
  return (
    <ActivityViewsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/:tripId" element={<TripDetailPage />} />
          <Route path="trips/:tripId/packing" element={<PackingListPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ActivityViewsProvider>
  )
}

export default function App() {
  const { ready, user, mode } = useAuth()
  const { profiles, profile, ready: profileReady } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && location.pathname === '/welcome') {
      navigate('/', { replace: true })
    }
  }, [user, location.pathname, navigate])

  const isPublicShare = location.pathname.startsWith('/share/')
  const publicToken = isPublicShare
    ? (location.pathname.slice('/share/'.length).split('/')[0] ?? '')
    : ''
  const isPrivacy = location.pathname === '/privacy'

  let content: React.ReactNode

  if (isPublicShare) {
    content = <PublicTripPage token={publicToken} />
  } else if (isPrivacy) {
    content = <PrivacyPage />
  } else if (!ready) {
    content = <Splash />
  } else if (mode === 'account' && user) {
    content = <AppRoutes />
  } else if (mode === 'guest') {
    if (location.pathname === '/welcome') {
      content = <AuthScreen />
    } else if (!profileReady) {
      content = <Splash />
    } else if (!profiles || profiles.length === 0) {
      content = <Onboarding />
    } else if (!profile) {
      content = <Splash />
    } else {
      content = <AppRoutes />
    }
  } else {
    content = <AuthScreen />
  }

  return (
    <>
      {content}
      {import.meta.env.PROD ? <UpdateBanner /> : null}
    </>
  )
}
