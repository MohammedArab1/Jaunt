import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isNetworkError } from '@/lib/api'
import { getErrorMessage } from '@/lib/utils'
import { Wordmark } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const features = [
  {
    icon: Cloud,
    color: '#5EC8FF',
    title: 'Everything follows you',
    body: 'Trips, plans, and tickets live in your account and show up on every device.',
  },
  {
    icon: WifiOff,
    color: '#4ADE97',
    title: 'Still works offline',
    body: 'Your account is cached on this device. Changes queue up and sync when you reconnect.',
  },
  {
    icon: Sparkles,
    color: '#FFD166',
    title: 'Free to use',
    body: 'No ads, no subscriptions. Just your trips, plans, and tickets in one place.',
  },
]

export function AuthScreen() {
  const { mode, login, register, continueOffline } = useAuth()
  const navigate = useNavigate()
  const [formMode, setFormMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = formMode === 'register'
  const isOfflineGuest = mode === 'guest'

  const switchMode = (next: 'login' | 'register') => {
    setFormMode(next)
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    if (isRegister && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setBusy(true)
    try {
      if (isRegister) await register(email.trim(), password)
      else await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (cause) {
      if (isNetworkError(cause)) {
        setError('Can’t reach the Jaunt server. You can use Jaunt without an account instead.')
      } else {
        setError(getErrorMessage(cause))
      }
      setBusy(false)
    }
  }

  const goOffline = () => {
    if (!isOfflineGuest) continueOffline()
    navigate('/', { replace: true })
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="app-ambient" aria-hidden />
      <div
        className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-violet/15 blur-[110px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 lg:flex-row lg:items-center lg:gap-20 lg:px-12 lg:py-12">
        <section className="flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <Wordmark markSize={34} />
            <ThemeToggle />
          </div>

          <div className="mt-10 lg:mt-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-fg/10 bg-fg/[0.04] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              Sync or stay offline.
            </span>

            <h1 className="mt-5 text-balance font-display text-[3rem] font-extrabold leading-[0.9] tracking-[-0.055em] text-fg sm:text-6xl xl:text-[4.2rem]">
              Your good days,{' '}
              <span className="bg-gradient-to-r from-coral via-punch to-violet bg-clip-text text-transparent">
                on every device.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] font-medium leading-relaxed text-muted">
              Sign in to keep trips, tickets, and today's plan in sync — or skip the account and keep
              everything right here in this browser.
            </p>
          </div>

          <div className="mt-9 hidden space-y-3.5 sm:block">
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

        <section className="mt-10 w-full lg:mt-0 lg:max-w-[430px]">
          <div className="relative overflow-hidden rounded-[32px] border border-fg/10 bg-surface/85 p-5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-coral/10 blur-3xl"
              aria-hidden
            />

            <div className="relative">
              {isOfflineGuest ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mb-5 inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-extrabold text-muted transition hover:text-fg"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to your offline plans
                </button>
              ) : null}

              <p className="eyebrow">{isRegister ? 'Start free' : 'Welcome back'}</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-fg">
                {isRegister ? 'Create your account.' : 'Sign in to Jaunt.'}
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
                {isRegister
                  ? 'Just an email and a password. Free to use.'
                  : 'Pick up exactly where you left off.'}
              </p>

              <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3.5 sm:space-y-4">
                <div>
                  <label className="field-label" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="field"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                      className="field pl-10 pr-11"
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:text-fg"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isRegister ? (
                    <p className="mt-1 text-[10px] font-medium text-muted/60">
                      Your password can’t be recovered by email, so keep it somewhere safe.
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-punch"
                  >
                    {error}
                  </p>
                ) : null}

                <button type="submit" className="btn btn-primary w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? 'One moment…' : isRegister ? 'Create account' : 'Sign in'}
                </button>
              </form>

              <p className="mt-3 text-center text-xs font-semibold text-muted">
                {isRegister ? 'Already have an account?' : 'New to Jaunt?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? 'login' : 'register')}
                  className="font-extrabold text-coral transition hover:opacity-80"
                >
                  {isRegister ? 'Sign in' : 'create an account'}
                </button>
              </p>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-fg/[0.08]" />
                <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted/50">
                  or
                </span>
                <span className="h-px flex-1 bg-fg/[0.08]" />
              </div>

              <button type="button" onClick={goOffline} className="btn btn-secondary w-full">
                <WifiOff className="h-4 w-4" />
                {isOfflineGuest ? 'Back to your offline plans' : 'Use without an account'}
              </button>
              <p className="mt-2.5 text-center text-[10px] font-medium leading-relaxed text-muted/60">
                No account needed. Your plans stay in this browser.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
