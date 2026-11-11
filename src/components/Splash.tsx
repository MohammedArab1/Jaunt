import { LogoMark } from '@/components/ui/Logo'

export function Splash() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="app-ambient" aria-hidden />
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="animate-float">
          <LogoMark size={64} className="shadow-2xl shadow-black/50" />
        </div>
        <p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.055em] text-cream">
          jaunt<span className="text-coral">.</span>
        </p>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted">
          Finding your good days
        </p>
      </div>
    </div>
  )
}
