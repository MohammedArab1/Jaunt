import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export function ThemeToggle() {
  const { resolvedMode, setMode } = useTheme()
  const next = resolvedMode === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      className="btn-icon h-10 w-10"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
