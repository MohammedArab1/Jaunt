import { Check, Laptop, Moon, Sun } from 'lucide-react'
import {
  ACCENTS,
  THEME_MODES,
  useTheme,
  type ThemeMode,
} from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

const MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Laptop,
}

export function AppearanceCard() {
  const { mode, setMode, accent, setAccent } = useTheme()

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
          Appearance
        </h2>
        <p className="mt-1 text-xs font-medium text-muted">Make it feel like yours.</p>
      </div>

      <div className="surface p-4">
        <p className="field-label">Theme</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-fg/10 bg-fg/[0.03] p-1">
          {THEME_MODES.map((option) => {
            const Icon = MODE_ICONS[option.value]
            const active = mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={active}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.06em] transition',
                  active
                    ? 'bg-coral text-ink shadow-sm'
                    : 'text-muted hover:bg-fg/[0.05] hover:text-fg',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            )
          })}
        </div>

        <p className="field-label mt-5">Accent color</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => {
            const active = accent === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAccent(option.value)}
                aria-label={`Use ${option.label} accent`}
                aria-pressed={active}
                className="relative grid h-9 w-9 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: option.color,
                  boxShadow: active
                    ? '0 0 0 3px var(--color-page), 0 0 0 5px currentColor'
                    : undefined,
                  color: option.color,
                }}
              >
                {active ? <Check className="h-4 w-4 text-ink" strokeWidth={3.5} /> : null}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted/60">
          Theme and accent are saved in this browser. “System” follows your device appearance.
        </p>
      </div>
    </section>
  )
}
