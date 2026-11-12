import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import type { Trip } from '@/types'
import { ApiError, api, isNetworkError } from '@/lib/api'
import { copyText, getErrorMessage } from '@/lib/utils'
import { useSync } from '@/context/SyncContext'
import { useToast } from '@/context/ToastContext'
import { Sheet } from '@/components/ui/Sheet'

interface TripShareSheetProps {
  trip: Trip
  onClose: () => void
}

function shareError(cause: unknown): string {
  if (isNetworkError(cause)) return 'Connect to the internet to manage public links.'
  return getErrorMessage(cause)
}

export function TripShareSheet({ trip, onClose }: TripShareSheetProps) {
  const { syncNow } = useSync()
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = token ? `${window.location.origin}/share/${token}` : ''

  const load = async (attempt = 0): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const payload = await api.trips.share(trip.id)
      setToken(payload.token)
      setLoading(false)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404 && attempt < 3) {
        // A just-created trip may not have reached the server yet.
        try {
          await syncNow()
        } catch {
          // The retry below will surface the real error.
        }
        await new Promise((resolve) => setTimeout(resolve, 900))
        return load(attempt + 1)
      }
      setError(shareError(cause))
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id])

  const createLink = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = await api.trips.createShare(trip.id)
      setToken(payload.token)
      toast('Public link created.', 'success')
    } catch (cause) {
      setError(shareError(cause))
    } finally {
      setBusy(false)
    }
  }

  const stopSharing = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.trips.deleteShare(trip.id)
      setToken(null)
      setConfirmStop(false)
      setCopied(false)
      toast('Public link turned off.', 'success')
    } catch (cause) {
      setError(shareError(cause))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    const copiedNow = await copyText(url)
    setCopied(copiedNow)
    toast(copiedNow ? 'Link copied.' : 'Could not copy the link.', copiedNow ? 'success' : 'error')
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Share this trip"
      description="Send a read-only itinerary to anyone, no Jaunt account needed."
      footer={
        <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="space-y-5 pb-1">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-punch/20 bg-punch/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-punch"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-coral" />
          </div>
        ) : token ? (
          <>
            <div className="rounded-2xl border border-mint/20 bg-mint/[0.06] p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-mint/15 bg-mint/[0.08] text-mint">
                  <Link2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-fg">Public link is on</p>
                  <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-muted">
                    Anyone with this link can view the itinerary.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={url}
                  aria-label="Public share link"
                  onFocus={(event) => event.currentTarget.select()}
                  className="field h-10 min-w-0 flex-1 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="btn btn-primary h-10 shrink-0 px-3 text-[10px]"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary mt-2 h-9 w-full text-[10px]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open public page
              </a>
            </div>

            <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.025] p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <p className="text-[11px] font-semibold leading-relaxed text-muted">
                  Tickets, confirmation numbers, links, and notes stay private. The public page only
                  shows the trip and its itinerary details.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-punch/15 bg-punch/[0.04] p-3.5">
              {confirmStop ? (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-fg">Turn off the public link?</p>
                  <p className="text-[11px] font-medium leading-relaxed text-muted">
                    Anyone using the current link will lose access immediately.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary h-9 flex-1 text-[10px]"
                      onClick={() => setConfirmStop(false)}
                      disabled={busy}
                    >
                      Keep sharing
                    </button>
                    <button
                      type="button"
                      className="btn h-9 flex-1 bg-punch text-[10px] text-ink hover:brightness-110"
                      onClick={() => void stopSharing()}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Turn off link
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="btn btn-secondary h-9 w-full text-[10px] text-punch"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Stop sharing
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[26px] border border-fg/[0.08] bg-fg/[0.025] p-5 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-coral/20 bg-coral/10 text-coral">
                <Share2 className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-xl font-extrabold tracking-[-0.02em] text-fg">
                Create a public link
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-muted">
                People with the link can view the trip in a clean read-only page. They cannot edit
                anything or see your private booking details.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-4"
                onClick={() => void createLink()}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                {busy ? 'Creating…' : 'Create public link'}
              </button>
            </div>

            <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.025] p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
                <p className="text-[11px] font-semibold leading-relaxed text-muted">
                  Tickets, confirmation numbers, links, and notes stay private. You can turn the link
                  off at any time.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
