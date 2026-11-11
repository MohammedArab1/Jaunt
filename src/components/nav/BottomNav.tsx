import { CalendarDays, Luggage, Plus, Settings2, Sun } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useActivityViews } from '@/context/ActivityViews'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/trips', label: 'Trips', icon: Luggage },
  { to: '/settings', label: 'More', icon: Settings2 },
] as const

function NavItem({ to, label, icon: Icon }: (typeof items)[number]) {
  const { pathname } = useLocation()
  const active = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)

  return (
    <Link
      to={to}
      className={cn(
        'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors',
        active ? 'text-coral' : 'text-muted hover:text-cream',
      )}
    >
      <Icon className={cn('h-[21px] w-[21px]', active && 'drop-shadow-[0_0_10px_rgba(255,107,74,0.5)]')} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[9px] font-extrabold uppercase tracking-[0.08em]">{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const { openCreate } = useActivityViews()

  return (
    <nav
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.65rem)] z-40 lg:hidden"
      aria-label="Main navigation"
    >
      <div className="relative flex h-[68px] items-center gap-0.5 rounded-[27px] border border-white/10 bg-[#121019]/95 px-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <NavItem {...items[0]} />
        <NavItem {...items[1]} />

        <div className="relative flex h-full w-[68px] shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="Add a plan"
            className="absolute -top-5 grid h-[58px] w-[58px] place-items-center rounded-full border-[5px] border-ink bg-gradient-to-br from-coral via-[#FF5C7A] to-violet text-ink shadow-[0_14px_30px_-8px_rgba(255,107,74,0.9)] transition active:scale-95"
          >
            <Plus className="h-6 w-6" strokeWidth={3} />
          </button>
        </div>

        <NavItem {...items[2]} />
        <NavItem {...items[3]} />
      </div>
    </nav>
  )
}
