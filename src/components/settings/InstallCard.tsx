import { Share, Smartphone } from 'lucide-react'
import { useInstall } from '@/context/InstallContext'
import { useToast } from '@/context/ToastContext'

export function InstallCard() {
  const { canInstall, installed, ios, install } = useInstall()
  const { toast } = useToast()

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-cream">
          Put it on your home screen
        </h2>
        <p className="mt-1 text-xs font-medium text-muted">Lose the browser bar. Keep the good stuff.</p>
      </div>

      <div className="surface p-4">
        <div className="flex items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-violet">
            <Smartphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {installed ? (
              <>
                <p className="text-sm font-extrabold text-mint">Installed like a real app</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted">
                  You're using the home-screen version of Jaunt. Everything still works offline.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-extrabold text-cream">Add Jaunt to your home screen</p>
                {canInstall ? (
                  <button
                    type="button"
                    onClick={() => {
                      void install().then((accepted) => {
                        if (accepted) toast('Jaunt is on your home screen.', 'success')
                      })
                    }}
                    className="btn btn-secondary mt-3 h-9 px-4 text-xs"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Install app
                  </button>
                ) : ios ? (
                  <ol className="mt-2 space-y-1.5 text-[11px] font-medium leading-relaxed text-muted">
                    <li className="flex gap-2">
                      <span className="text-coral">1.</span> Open this site in Safari.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-coral">2.</span>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        Tap <Share className="inline h-3.5 w-3.5" /> Share.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-coral">3.</span> Choose “Add to Home Screen.”
                    </li>
                  </ol>
                ) : (
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted">
                    Open your browser menu and choose “Install app” or “Add to Home Screen.” The site
                    needs to be served over HTTPS.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
