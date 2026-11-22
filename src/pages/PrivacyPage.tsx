import { useEffect } from 'react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function PrivacyPage() {
  useEffect(() => {
    const previousTitle = document.title
    const canonical = document.querySelector('link[rel="canonical"]')
    const previousCanonical = canonical?.getAttribute('href')

    document.title = 'Privacy · Jaunt'
    canonical?.setAttribute('href', 'https://planjaunt.com/privacy')

    return () => {
      document.title = previousTitle
      if (previousCanonical) canonical?.setAttribute('href', previousCanonical)
    }
  }, [])

  return (
    <div className="relative min-h-dvh">
      <div className="app-ambient" aria-hidden />

      <div className="page-enter relative z-10 mx-auto w-full max-w-2xl px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 lg:pt-12">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex rounded-xl" aria-label="Back to Jaunt">
            <Wordmark markSize={30} />
          </Link>
          <ThemeToggle />
        </header>

        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-xs font-extrabold text-muted transition hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jaunt
          </Link>
          <p className="eyebrow mt-6">Privacy</p>
          <h1 className="mt-2 text-balance font-display text-[2.7rem] font-extrabold leading-[0.94] tracking-[-0.045em] text-fg sm:text-5xl">
            Your plans are yours.
          </h1>
          <p className="mt-4 text-sm font-medium leading-relaxed text-muted">
            This page explains what Jaunt stores, where it lives, and what you can do about it.
          </p>
        </div>

        <div className="mt-9 max-w-[68ch] space-y-7 text-pretty text-sm leading-relaxed text-muted">
          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              What Jaunt stores
            </h2>
            <p className="mt-2">
              If you create an account, Jaunt stores your email address, password hash, display name,
              and color. It also stores the trips, plans, packing lists, and ticket files you add.
              Your password itself is never stored.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Where it lives
            </h2>
            <p className="mt-2">
              Account data lives on the server that runs planjaunt.com. A copy is cached in your
              browser so the app keeps working offline. If you use Jaunt without an account, your
              plans stay in this browser and are not sent to the server.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Data safety
            </h2>
            <div className="mt-2 rounded-2xl border border-sun/20 bg-sun/[0.06] p-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun" aria-hidden />
                <div>
                  <p>
                    Jaunt is a small, independently run service, not a managed backup service. I make
                    a best effort to keep the server healthy and keep backups, but I can&apos;t
                    guarantee uptime, data durability, or recovery. If something goes wrong, some or
                    all of your data may be lost.
                  </p>
                  <p className="mt-3">
                    Treat Jaunt as a convenient copy, not the only copy, of anything important. You
                    can download your trips, plans, packing lists, and cached ticket files from{' '}
                    <strong className="font-extrabold text-fg">Settings → Your data</strong> whenever
                    you like.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              What Jaunt doesn&apos;t do
            </h2>
            <p className="mt-2">
              There are no ads, no third-party analytics, and no selling of your data. Jaunt only
              contacts the weather and city-search services needed to show the information you ask
              for.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Cookies and local storage
            </h2>
            <p className="mt-2">
              A signed-in session uses one HTTP-only cookie so the server can recognize you. Theme
              preferences, the active profile, and the offline cache are kept in your browser&apos;s
              local storage. There are no tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Public links
            </h2>
            <p className="mt-2">
              Public trip links are unlisted, not password-protected. Anyone with the link can view
              the itinerary, so only share it with people you trust. You can revoke a link at any
              time from the trip&apos;s Share sheet.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Your controls
            </h2>
            <p className="mt-2">
              In Settings → Your data, you can download a JSON copy of your trips, plans, packing
              lists, and cached ticket files, or permanently delete your account. Signing out removes
              the account&apos;s offline copy from this device; your server data remains.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Questions
            </h2>
            <p className="mt-2">
              Open an issue in the{' '}
              <a
                href="https://github.com/MohammedArab1/Jaunt/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-coral underline decoration-coral/30 underline-offset-4 transition hover:decoration-coral"
              >
                Jaunt repository
              </a>
              .
            </p>
          </section>
        </div>

        <footer className="mt-10 border-t border-fg/[0.06] pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/50">
          Last updated November 22, 2026
        </footer>
      </div>
    </div>
  )
}
