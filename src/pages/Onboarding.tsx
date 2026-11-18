import { ArrowLeft, CalendarHeart, Paperclip, ShieldCheck, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { Wordmark } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ProfileForm } from '@/components/profile/ProfileForm'

const features = [
  {
    icon: CalendarHeart,
    color: '#FF8A3D',
    title: 'Build the whole adventure',
    body: 'Multi-day trips, flights, dinners, and the little stops in between.',
  },
  {
    icon: Paperclip,
    color: '#A98BFF',
    title: 'Tickets in your pocket',
    body: 'Attach photos and PDFs straight to the plan that needs them.',
  },
  {
    icon: Sun,
    color: '#4ADE97',
    title: 'Today shows up first',
    body: 'Open the app and the day is already there. Cross things off as you go.',
  },
]

export function Onboarding() {
  const { createProfile } = useProfile()
  const { exitOffline } = useAuth()
  const navigate = useNavigate()

  const backToSignIn = () => {
    exitOffline()
    navigate('/', { replace: true })
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="app-ambient" aria-hidden />
      <div
        className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-coral/15 blur-[100px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 lg:flex-row lg:items-center lg:gap-20 lg:px-12 lg:py-12">
        <section className="flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <Wordmark markSize={34} />
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={backToSignIn}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-extrabold text-muted transition hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>

          <div className="mt-6 lg:mt-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-fg/10 bg-fg/[0.04] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              Your days, in motion
            </span>

            <h1 className="mt-5 text-balance font-display text-[3.1rem] font-extrabold leading-[0.9] tracking-[-0.055em] text-fg sm:text-6xl xl:text-[4.4rem]">
              Go make some{' '}
              <span className="bg-gradient-to-r from-coral via-punch to-violet bg-clip-text text-transparent">
                good days.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] font-medium leading-relaxed text-muted">
              Jaunt keeps your trips, tickets, and today's plan in one bold little place — so you can
              stop juggling screens and go live it.
            </p>
          </div>

          <div className="mt-10 hidden space-y-3.5 sm:block">
            {features.map(({ icon: Icon, color, title, body }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-fg/[0.07]"
                  style={{ backgroundColor: `${color}1f`, color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-fg">{title}</p>
                  <p className="mt-0.5 max-w-sm text-xs font-medium leading-relaxed text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 w-full lg:mt-0 lg:max-w-[420px]">
          <div className="relative">
            <div
              className="absolute -right-4 -top-5 z-10 hidden rotate-3 items-center gap-1.5 rounded-full border border-page/20 bg-sun px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink shadow-xl sm:flex"
              aria-hidden
            >
              No accounts. No noise.
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-fg/10 bg-surface/85 p-6 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
              <div
                className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet/15 blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <p className="eyebrow">First things first</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-fg">
                  Who's planning?
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
                  Make a space for yourself. A few people share this device? Add profiles later in
                  Settings.
                </p>

                <ProfileForm initialColor="#FF6B4A" submitLabel="Start planning" onSubmit={async (name, color) => {
                  await createProfile(name, color)
                }} />

                <div className="mt-6 flex items-start gap-2.5 border-t border-fg/[0.07] pt-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                  <p className="text-[11px] font-semibold leading-relaxed text-muted">
                    Offline mode keeps everything in this browser. No account, no cloud, no one else
                    reading over your shoulder.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
