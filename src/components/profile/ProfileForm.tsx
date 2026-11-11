import { useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PROFILE_COLORS } from '@/lib/palette'
import { getErrorMessage } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

interface ProfileFormProps {
  initialName?: string
  initialColor?: string
  submitLabel: string
  onSubmit: (name: string, color: string) => Promise<void> | void
  onCancel?: () => void
}

export function ProfileForm({
  initialName = '',
  initialColor = PROFILE_COLORS[0].value,
  submitLabel,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Add a name to get started.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(name.trim(), color)
    } catch (cause) {
      setError(getErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={name.trim() || '✦'} color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <label className="field-label" htmlFor="profile-name">
            Your name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Mo"
            className="field"
            maxLength={40}
            autoComplete="nickname"
          />
        </div>
      </div>

      <div>
        <p className="field-label">Pick your color</p>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Profile color">
          {PROFILE_COLORS.map((option) => {
            const selected = color === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.name}
                onClick={() => setColor(option.value)}
                className="relative grid aspect-square w-full place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: option.value,
                  boxShadow: selected ? `0 0 0 3px #0B0A10, 0 0 0 5px ${option.value}` : undefined,
                }}
              >
                {selected ? <Check className="h-4 w-4 text-ink" strokeWidth={3.5} /> : null}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2 text-xs font-bold text-[#FFB3C5]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2.5 pt-1">
        {onCancel ? (
          <button type="button" className="btn btn-secondary px-5" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
