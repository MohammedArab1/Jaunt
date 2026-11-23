import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  AlertTriangle,
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  Import as ImportIcon,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '@/db'
import type { Profile } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { useProfile } from '@/context/ProfileContext'
import { useSync } from '@/context/SyncContext'
import { useToast } from '@/context/ToastContext'
import { downloadAccountExport } from '@/lib/backup'
import { importGuestProfileIntoAccount } from '@/lib/importGuest'
import { FEEDBACK_URL, REPOSITORY_URL } from '@/lib/links'
import { getErrorMessage, pluralize } from '@/lib/utils'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Wordmark } from '@/components/ui/Logo'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { InstallCard } from '@/components/settings/InstallCard'
import { AppearanceCard } from '@/components/settings/AppearanceCard'
import { ChangePasswordSheet } from '@/components/settings/ChangePasswordSheet'

interface GuestStats {
  trips: number
  plans: number
}

export function AccountSettingsPage() {
  const { user, logout, deleteAccount, updateAccount } = useAuth()
  const { guestProfiles } = useProfile()
  const { status, error, lastSyncedAt, syncNow } = useSync()
  const { toast } = useToast()
  const userId = user?.id ?? ''

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [importTarget, setImportTarget] = useState<Profile | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  const tripCount = useLiveQuery(
    () => (userId ? db.trips.where('profileId').equals(userId).count() : Promise.resolve(0)),
    [userId],
    0,
  )
  const planCount = useLiveQuery(
    () => (userId ? db.activities.where('profileId').equals(userId).count() : Promise.resolve(0)),
    [userId],
    0,
  )

  const guestIds = useMemo(
    () => (guestProfiles ?? []).map((profile) => profile.id).sort(),
    [guestProfiles],
  )
  const guestIdsKey = guestIds.join('|')

  const guestStats = useLiveQuery(
    async () => {
      if (!guestIds.length) return {}
      const [trips, activities] = await Promise.all([
        db.trips.where('profileId').anyOf(guestIds).toArray(),
        db.activities.where('profileId').anyOf(guestIds).toArray(),
      ])
      const stats: Record<string, GuestStats> = {}
      for (const id of guestIds) stats[id] = { trips: 0, plans: 0 }
      for (const trip of trips) {
        if (stats[trip.profileId]) stats[trip.profileId].trips += 1
      }
      for (const activity of activities) {
        if (stats[activity.profileId]) stats[activity.profileId].plans += 1
      }
      return stats
    },
    [guestIdsKey],
    {} as Record<string, GuestStats>,
  )

  if (!user) return null

  const syncing = status === 'syncing'
  const syncLabel = syncing
    ? 'Syncing your plans…'
    : status === 'offline'
      ? 'Offline — changes are queued'
      : status === 'error'
        ? (error ?? 'Sync needs attention')
        : lastSyncedAt
          ? Date.now() - lastSyncedAt < 30_000
            ? 'Synced just now'
            : `Synced ${formatDistanceToNowStrict(lastSyncedAt, { addSuffix: true })}`
          : 'Ready to sync'

  const syncTone =
    status === 'offline' ? 'text-sun' : status === 'error' ? 'text-punch' : syncing ? 'text-sky' : 'text-mint'
  const SyncIcon = syncing ? RefreshCw : status === 'offline' ? CloudOff : status === 'error' ? AlertTriangle : Cloud

  const importProfile = async () => {
    if (!importTarget) return
    const result = await importGuestProfileIntoAccount(importTarget.id, user.id)
    const imported = [pluralize(result.activities, 'plan')]
    if (result.trips > 0) imported.push(pluralize(result.trips, 'trip'))
    if (result.packingItems > 0) imported.push(pluralize(result.packingItems, 'packing item'))
    toast(`Imported ${imported.join(', ')}.`, 'success', 5000)
    setImportTarget(null)
    void syncNow()
  }

  const downloadData = async () => {
    setExportBusy(true)
    try {
      await downloadAccountExport(user)
      toast('Account export downloaded.', 'success')
    } catch (cause) {
      toast(getErrorMessage(cause), 'error')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Your account"
        title={user.displayName}
        description={user.email}
      />

      <AppearanceCard />

      <section className="surface relative mt-8 overflow-hidden p-4">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: `${user.color}22` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <Avatar name={user.displayName} color={user.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Signed in</p>
            <h2 className="break-words font-display text-2xl font-extrabold leading-tight tracking-[-0.03em] text-fg">
              {user.displayName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="btn-icon h-9 w-9"
            aria-label="Edit account profile"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
            Password
          </h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Change the password used to sign in to this account.
          </p>
        </div>

        <div className="surface overflow-hidden">
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-fg/[0.03]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] text-muted">
              <KeyRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-fg">Change password</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
                Other devices will be signed out. This device stays signed in.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">Sync</h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Your plans sync automatically and stay available offline.
          </p>
        </div>

        <div className="surface p-4">
          <div className="flex items-start gap-3.5">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] ${syncTone}`}
            >
              <SyncIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-extrabold ${syncTone}`}>{syncLabel}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-muted">
                {status === 'offline'
                  ? 'You can keep planning. Changes will upload automatically when the connection returns.'
                  : status === 'error'
                    ? 'Your local plans are safe. Try again, or sign out and back in if this keeps happening.'
                    : 'Changes sync automatically. You can also sync manually below.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing}
              className="btn btn-secondary h-9 shrink-0 px-3 text-[10px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing' : 'Sync now'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-fg/[0.06] pt-3">
            <div className="rounded-xl bg-fg/[0.025] px-3 py-2">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted/60">Trips</p>
              <p className="font-display text-lg font-extrabold text-fg">{tripCount}</p>
            </div>
            <div className="rounded-xl bg-fg/[0.025] px-3 py-2">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted/60">Plans</p>
              <p className="font-display text-lg font-extrabold text-fg">{planCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">Your data</h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Take a copy of your plans, or close your account for good.
          </p>
        </div>

        <div className="surface divide-y divide-fg/[0.06] overflow-hidden">
          <button
            type="button"
            onClick={() => void downloadData()}
            disabled={exportBusy}
            className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-fg/[0.03] disabled:opacity-60"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/[0.08] bg-fg/[0.04] text-mint">
              {exportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-fg">
                {exportBusy ? 'Preparing your export…' : 'Download my data'}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
                A JSON copy of your trips, plans, packing lists, and cached ticket files.
              </span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted/40">
              JSON
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-punch/[0.05]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-punch/15 bg-punch/[0.07] text-punch">
              <Trash2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-fg">Delete account</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
                Permanently remove your account and all its data.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </div>

        <Link
          to="/privacy"
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted/60 transition hover:text-fg"
        >
          <ShieldCheck className="h-3 w-3" />
          Read the privacy notes
        </Link>
      </section>

      {guestProfiles && guestProfiles.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3">
            <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">
              Bring your offline plans along
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
              Copy a local profile into this account. The original stays available in offline mode.
            </p>
          </div>

          <div className="surface divide-y divide-fg/[0.06] overflow-hidden">
            {guestProfiles.map((profile) => {
              const stats = guestStats[profile.id] ?? { trips: 0, plans: 0 }
              return (
                <div key={profile.id} className="flex items-center gap-3.5 p-3.5">
                  <Avatar name={profile.name} color={profile.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-fg">{profile.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-muted">
                      {pluralize(stats.trips, 'trip')} · {pluralize(stats.plans, 'plan')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportTarget(profile)}
                    disabled={stats.trips === 0 && stats.plans === 0}
                    className="btn btn-secondary h-8 px-3 text-[10px]"
                  >
                    <ImportIcon className="h-3 w-3" />
                    Import
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <InstallCard />

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-fg">Sign out</h2>
        </div>
        <div className="surface overflow-hidden">
          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-punch/[0.05]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-punch/15 bg-punch/[0.07] text-punch">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-fg">Sign out of this device</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
                Remove this account's offline copy. Your plans stay safe on the server.
              </span>
            </span>
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-sun/15 bg-sun/[0.05] px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
          <p className="text-[11px] font-semibold leading-relaxed text-muted">
            Sync before signing out if you have unsynced changes. Sign-in requires a connection.
          </p>
        </div>
      </section>

      <footer className="mt-10 flex flex-col items-center gap-2 border-t border-fg/[0.06] pt-8 pb-2 text-center">
        <Wordmark markSize={26} />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted/50">
          Version 1.2 · Synced & offline
        </p>
        <div className="flex items-center gap-4 text-[10px] font-semibold text-muted/60">
          <Link to="/privacy" className="transition hover:text-fg">
            Privacy
          </Link>
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-fg"
          >
            Feedback
          </a>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-fg"
          >
            Open source
          </a>
        </div>
      </footer>

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out of this account?"
        description="This removes the account's offline copy from this device. Your plans remain stored on the server."
        confirmLabel="Sign out"
        destructive
        onConfirm={async () => {
          await logout()
          toast('Signed out. Your plans are safe on the server.', 'success', 5000)
        }}
      >
        <div className="rounded-2xl border border-punch/15 bg-punch/[0.05] p-4">
          <p className="text-sm font-semibold leading-relaxed text-muted">
            Anything that hasn't synced yet will be lost. {status === 'offline' ? 'You are currently offline, so sync first.' : 'Use Sync now first if you are unsure.'}
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeletePassword('')
        }}
        title="Delete your account?"
        description="This permanently deletes your account, trips, plans, packing lists, and ticket files from the server and this device."
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          if (!deletePassword) throw new Error('Enter your password.')
          await deleteAccount(deletePassword)
          toast('Your account was deleted.', 'success', 5000)
        }}
      >
        <div className="space-y-3">
          <p className="rounded-2xl border border-punch/15 bg-punch/[0.05] p-4 text-sm font-semibold leading-relaxed text-muted">
            This cannot be undone. Download your data first if you want a copy.
          </p>
          <Field label="Password" htmlFor="delete-account-password">
            <input
              id="delete-account-password"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
              className="field"
              placeholder="Your password"
            />
          </Field>
        </div>
      </ConfirmDialog>

      {passwordOpen ? (
        <ChangePasswordSheet onClose={() => setPasswordOpen(false)} />
      ) : null}

      {editOpen ? (
        <Sheet
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          title="Edit account"
          description="Change how you show up around Jaunt."
        >
          <ProfileForm
            initialName={user.displayName}
            initialColor={user.color}
            submitLabel="Save changes"
            onCancel={() => setEditOpen(false)}
            onSubmit={async (name, color) => {
              await updateAccount(name, color)
              setEditOpen(false)
              toast('Account updated.', 'success')
            }}
          />
        </Sheet>
      ) : null}

      <ConfirmDialog
        open={Boolean(importTarget)}
        onOpenChange={(open) => !open && setImportTarget(null)}
        title={importTarget ? `Import ${importTarget.name}?` : 'Import profile'}
        description="This copies the offline profile's trips, plans, photos, and tickets into your account."
        confirmLabel="Import plans"
        onConfirm={importProfile}
      >
        {importTarget ? (
          <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.025] p-4">
            <div className="flex items-center gap-3">
              <Avatar name={importTarget.name} color={importTarget.color} size="sm" />
              <div>
                <p className="text-sm font-extrabold text-fg">{importTarget.name}</p>
                <p className="text-[10px] font-bold text-muted">
                  {pluralize(guestStats[importTarget.id]?.trips ?? 0, 'trip')} ·{' '}
                  {pluralize(guestStats[importTarget.id]?.plans ?? 0, 'plan')}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted">
              The original profile stays untouched in offline mode. Files will upload in the background
              after the plans sync.
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

    </Page>
  )
}
