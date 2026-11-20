import { useState } from 'react'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import type { PackingCategory, PackingItem } from '@/types'
import { PACKING_CATEGORIES } from '@/lib/packing'
import { deletePackingItem, updatePackingItem } from '@/lib/repo'
import { cn, getErrorMessage, isImeComposing } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'
import { Field } from '@/components/ui/Field'
import { PACKING_ICONS, PACKING_TONES } from './packingMeta'

interface PackingItemSheetProps {
  item: PackingItem
  onClose: () => void
}

export function PackingItemSheet({ item, onClose }: PackingItemSheetProps) {
  const { toast } = useToast()
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<PackingCategory>(item.category)
  const [quantity, setQuantity] = useState(item.quantity)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeArmed, setRemoveArmed] = useState(false)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give this item a name.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await updatePackingItem({ ...item, name: trimmed, category, quantity })
      onClose()
    } catch (cause) {
      setError(getErrorMessage(cause))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removeArmed) {
      setRemoveArmed(true)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await deletePackingItem(item.id)
      toast('Removed from the packing list.', 'success')
      onClose()
    } catch (cause) {
      setError(getErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Edit item"
      description="Rename it, change the category, or adjust how many you need."
      footer={
        <div className="flex gap-2.5">
          <button type="button" className="btn btn-secondary px-6" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save item'}
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-1">
        {error ? (
          <p
            className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-punch"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Field label="Item" htmlFor="packing-item-name">
          <input
            id="packing-item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || isImeComposing(event)) return
              event.preventDefault()
              void save()
            }}
            placeholder="Passport, charger, sunscreen…"
            className="field font-bold"
            maxLength={200}
            autoComplete="off"
          />
        </Field>

        <div>
          <p className="field-label">Category</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PACKING_CATEGORIES.map((option) => {
              const Icon = PACKING_ICONS[option.value]
              const active = category === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition',
                    active
                      ? PACKING_TONES[option.value]
                      : 'border-fg/10 bg-fg/[0.03] text-muted hover:border-fg/20 hover:bg-fg/[0.06]',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-extrabold">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-fg/10 bg-fg/[0.025] p-3.5">
          <div>
            <p className="text-sm font-extrabold text-fg">Quantity</p>
            <p className="mt-0.5 text-[10px] font-semibold text-muted">How many to bring</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              className="btn-icon-sm h-8 w-8 border border-fg/10 bg-fg/[0.04]"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center font-display text-lg font-extrabold text-fg" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              disabled={quantity >= 99}
              className="btn-icon-sm h-8 w-8 border border-fg/10 bg-fg/[0.04]"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-punch/15 bg-punch/[0.04] p-3.5">
          <p className="text-xs font-bold text-fg">Remove from this list</p>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition',
              removeArmed
                ? 'bg-punch text-ink hover:brightness-110'
                : 'border border-punch/25 text-punch hover:bg-punch/10',
            )}
          >
            <Trash2 className="h-3 w-3" />
            {removeArmed ? 'Tap again to remove' : 'Remove item'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
