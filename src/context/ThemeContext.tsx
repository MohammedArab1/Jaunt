import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AccentKey = 'coral' | 'sun' | 'mint' | 'sky' | 'violet' | 'punch' | 'lime'

export const THEME_MODES: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const ACCENTS: Array<{ value: AccentKey; label: string; color: string }> = [
  { value: 'coral', label: 'Coral', color: '#FF6B4A' },
  { value: 'sun', label: 'Sunbeam', color: '#FFB627' },
  { value: 'mint', label: 'Mint', color: '#34D399' },
  { value: 'sky', label: 'Sky', color: '#38BDF8' },
  { value: 'violet', label: 'Violet', color: '#8B5CF6' },
  { value: 'punch', label: 'Punch', color: '#F43F5E' },
  { value: 'lime', label: 'Lime', color: '#A3E635' },
]

const STORAGE_KEY = 'jaunt.appearance'

interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  accent: AccentKey
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: AccentKey) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isValidMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isValidAccent(value: unknown): value is AccentKey {
  return ACCENTS.some((accent) => accent.value === value)
}

function readAppearance(): { mode: ThemeMode; accent: AccentKey } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { mode: 'dark', accent: 'coral' }
    const parsed = JSON.parse(raw) as { mode?: unknown; accent?: unknown }
    return {
      mode: isValidMode(parsed.mode) ? parsed.mode : 'dark',
      accent: isValidAccent(parsed.accent) ? parsed.accent : 'coral',
    }
  } catch {
    return { mode: 'dark', accent: 'coral' }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readAppearance, [])
  const [mode, setModeState] = useState<ThemeMode>(initial.mode)
  const [accent, setAccentState] = useState<AccentKey>(initial.accent)
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemDark(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const resolvedMode: 'light' | 'dark' =
    mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode
    document.documentElement.dataset.accent = accent
    document.documentElement.style.colorScheme = resolvedMode
    const meta = document.getElementById('theme-color-meta')
    if (meta) meta.setAttribute('content', resolvedMode === 'light' ? '#F6F1E8' : '#0B0A10')

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }))
    } catch {
      // Ignore private-mode storage failures.
    }
  }, [resolvedMode, accent, mode])

  const setMode = useCallback((next: ThemeMode) => setModeState(next), [])
  const setAccent = useCallback((next: AccentKey) => setAccentState(next), [])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, accent, setMode, setAccent }),
    [mode, resolvedMode, accent, setMode, setAccent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
