import {
  CalendarDays,
  ChevronRight,
  Cloud,
  CloudOff,
  Luggage,
  Plus,
  Search,
  Settings2,
  Sun,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '@/context/ProfileContext'
import { useActivityViews } from '@/context/ActivityViews'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { Avatar } from '@/components/ui/Avatar'
import { Wordmark } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/trips', label: 'Trips', icon: Luggage },
  { to: '/settings', label: 'Settings', icon: Settings2 },
] as const

export function SideNav() {
  const { pathname } = useLocation()
  const { profile } = useProfile()
  const { mode } = useAuth()
  const { status, lastSyncedAt } = useSync()
  const { openCreate } = useActivityViews()
  const navigate = useNavigate()

  const syncLabel =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? 'Offline'
        : status === 'error'
          ? 'Sync issue'
          : lastSyncedAt
            ? 'Synced'
            : 'Account'
  const syncColor =
    status === 'offline'
      ? 'text-sun'
      : status === 'error'
        ? 'text-punch'
        : lastSyncedAt && status === 'idle'
          ? 'text-mint'
          : 'text-muted'

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-fg/[0.07] bg-page/60 px-5 py-7 backdrop-blur-xl lg:flex">
      <Link to="/" className="mb-10 inline-flex rounded-xl px-1">
        <Wordmark markSize={32} />
      </Link>

      <button type="button" onClick={() => openCreate()} className="btn btn-primary mb-8 w-full">
        <Plus className="h-4 w-4" strokeWidth={2.8} />
        New plan
      </button>

      <nav className="space-y-1.5" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-extrabold transition-colors',
                active ? 'bg-fg/[0.07] text-fg' : 'text-muted hover:bg-fg/[0.04] hover:text-fg',
              )}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-coral" />
              ) : null}
              <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto">
        {mode === 'guest' ? (
          <Link
            to="/welcome"
            className="mb-3 flex items-start gap-2.5 rounded-2xl border border-sky/20 bg-sky/[0.06] px-3.5 py-3 transition hover:bg-sky/[0.1]"
          >
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-sky" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold text-fg">Sync across devices</span>
              <span className="mt-0.5 block text-[10px] font-medium leading-relaxed text-muted">
                Sign in or create an account. Offline profiles stay here.
              </span>
            </span>
          </Link>
        ) : null}

        {profile ? (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-3 rounded-2xl border border-fg/[0.08] bg-fg/[0.035] p-2.5 text-left transition hover:bg-fg/[0.06]"
          >
            <Avatar name={profile.name} color={profile.color} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-fg">{profile.name}</span>
              <span className={cn('block text-[10px] font-bold uppercase tracking-[0.12em]', syncColor)}>
                {mode === 'account' ? (
                  <span className="inline-flex items-center gap-1">
                    {status === 'offline' ? <CloudOff className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    {syncLabel}
                  </span>
                ) : (
                  'Your space'
                )}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
        ) : null}
      </div>
    </aside>
  )
}
