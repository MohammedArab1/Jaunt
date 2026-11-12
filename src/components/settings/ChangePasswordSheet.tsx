import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { api, isNetworkError } from '@/lib/api'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'
import { Field } from '@/components/ui/Field'

interface ChangePasswordSheetProps {
  onClose: () => void
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder: string
  autoFocus?: boolean
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false)

  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="field pl-10 pr-11"
          autoComplete={autoComplete}
          maxLength={128}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:text-fg"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}

export function ChangePasswordSheet({ onClose }: ChangePasswordSheetProps) {
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)

    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Choose a password that is different from your current one.')
      return
    }

    setBusy(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      toast('Password changed. Other devices were signed out.', 'success', 5000)
      onClose()
    } catch (cause) {
      setError(
        isNetworkError(cause)
          ? 'Connect to the internet to change your password.'
          : getErrorMessage(cause),
      )
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Change password"
      description="Use a new password for future sign-ins."
      footer={
        <div className="grid gap-2">
          <button
            type="submit"
            form="change-password-form"
            className="btn btn-primary w-full"
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? 'Changing…' : 'Save new password'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost h-9"
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      }
    >
      <form
        id="change-password-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="space-y-4 pb-1"
      >
        <PasswordField
          id="current-password"
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          placeholder="Your current password"
          autoFocus
        />
        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <PasswordField
          id="confirm-new-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repeat the new password"
        />

        <div className="flex items-start gap-2.5 rounded-2xl border border-mint/15 bg-mint/[0.05] px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
          <p className="text-[11px] font-semibold leading-relaxed text-muted">
            Changing your password signs out every other device. This device stays signed in.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-punch"
          >
            {error}
          </p>
        ) : null}
      </form>
    </Sheet>
  )
}
