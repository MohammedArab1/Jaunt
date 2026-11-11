import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  ChevronRight,
  Cloud,
  Database,
  Download,
  HardDrive,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '@/db'
import { downloadBackup, restoreBackup } from '@/lib/backup'
import { formatBytes, getErrorMessage, pluralize } from '@/lib/utils'
import { useProfile } from '@/context/ProfileContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Page } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Wordmark } from '@/components/ui/Logo'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { InstallCard } from '@/components/settings/InstallCard'
import { AccountSettingsPage } from './AccountSettingsPage'

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-[-0.025em] text-cream">{title}</h2>
        {description ? <p className="mt-1 text-xs font-medium text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function ActionRow({
  icon,
  title,
  detail,
  onClick,
  disabled,
  trailing,
}: {
  icon: ReactNode
  title: string
  detail?: string
  onClick?: () => void
  disabled?: boolean
  trailing?: ReactNode
}) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-cream">{title}</span>
        {detail ? <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">{detail}</span> : null}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" /> : null)}
    </>
  )

  if (!onClick) {
    return <div className="flex w-full items-center gap-3.5 p-4 text-left">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-white/[0.03] disabled:opacity-50"
    >
      {content}
    </button>
  )
}

export function SettingsPage() {
  const { mode } = useAuth()
  return mode === 'account' ? <AccountSettingsPage /> : <GuestSettingsPage />
}

function GuestSettingsPage() {
  const { profile, profiles, createProfile, updateProfile, deleteProfile, selectProfile } = useProfile()
  const { toast } = useToast()
  const profileId = profile?.id ?? ''

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<File | null>(null)
  const [usage, setUsage] = useState<StorageEstimate | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const tripCount = useLiveQuery(
    () => (profileId ? db.trips.where('profileId').equals(profileId).count() : Promise.resolve(0)),
    [profileId],
    0,
  )
  const planCount = useLiveQuery(
    () => (profileId ? db.activities.where('profileId').equals(profileId).count() : Promise.resolve(0)),
    [profileId],
    0,
  )

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((estimate) => setUsage(estimate))
      .catch(() => undefined)
  }, [])

  if (!profile) return null

  const exportBackup = async () => {
    setBackupBusy(true)
    try {
      await downloadBackup()
      toast('Backup downloaded. Keep it somewhere safe.', 'success', 5000)
    } catch (cause) {
      toast(getErrorMessage(cause), 'error', 5000)
    } finally {
      setBackupBusy(false)
    }
  }

  const restore = async () => {
    if (!pendingRestore) return
    try {
      const text = await pendingRestore.text()
      const backup = await restoreBackup(text)
      const first = backup.profiles[0]
      if (first) selectProfile(first.id)
      setPendingRestore(null)
      toast(
        `Backup restored — ${pluralize(backup.profiles.length, 'profile')}, ${pluralize(backup.activities.length, 'plan')}.`,
        'success',
        5000,
      )
    } catch (cause) {
      throw new Error(getErrorMessage(cause))
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Your space"
        title="Settings"
        description="Profiles, backups, and the keys to your little corner of the internet."
      />

      <Link
        to="/welcome"
        className="group mb-4 flex items-center gap-3.5 rounded-[26px] border border-sky/20 bg-gradient-to-br from-sky/[0.09] via-white/[0.03] to-transparent p-4 transition hover:border-sky/35 hover:from-sky/[0.13]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-sky/15 bg-sky/[0.09] text-sky">
          <Cloud className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-cream">Sync across your devices</span>
          <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
            Sign in or create an account. Your offline profiles stay right here.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-sky/70 transition group-hover:translate-x-0.5" />
      </Link>

      <section className="surface relative overflow-hidden p-4">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full blur-3xl"
          style={{ backgroundColor: `${profile.color}22` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <Avatar name={profile.name} color={profile.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Current profile</p>
            <h2 className="break-words font-display text-2xl font-extrabold leading-tight tracking-[-0.03em] text-cream">
              {profile.name}
            </h2>
            <p className="mt-1 text-[11px] font-bold text-muted">
              {pluralize(tripCount, 'trip')} · {pluralize(planCount, 'plan')} · local
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="btn-icon"
            aria-label="Edit your profile"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading
          title="People on this device"
          description="Each profile keeps its own trips and plans."
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn btn-secondary h-8 px-3 text-[10px]"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          }
        />

        <div className="surface divide-y divide-white/[0.06] overflow-hidden">
          {(profiles ?? []).map((item) => {
            const active = item.id === profile.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!active) {
                    selectProfile(item.id)
                    toast(`Switched to ${item.name}.`)
                  }
                }}
                className="flex w-full items-center gap-3.5 p-3.5 text-left transition hover:bg-white/[0.03]"
                aria-current={active ? 'true' : undefined}
              >
                <Avatar name={item.name} color={item.color} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-cream">{item.name}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                    {active ? 'Active profile' : 'Tap to switch'}
                  </span>
                </span>
                {active ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-coral text-ink">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted" />
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[10px] font-medium leading-relaxed text-muted/60">
          <UserRound className="mt-0.5 h-3 w-3 shrink-0" />
          No passwords for offline profiles. They are just separate spaces in this browser.
        </p>
      </section>

      <section className="mt-8">
        <SectionHeading
          title="Your data"
          description="A safety net for everything on board — tickets included."
        />

        <div className="surface divide-y divide-white/[0.06] overflow-hidden">
          <div className="flex items-center gap-3.5 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-mint">
              <HardDrive className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-cream">Stored on this device</p>
              <p className="mt-0.5 text-[11px] font-medium text-muted">
                {usage?.usage ? `${formatBytes(usage.usage)} used` : 'Local browser storage'}
              </p>
            </div>
            <Database className="h-4 w-4 text-muted/50" />
          </div>

          <ActionRow
            icon={backupBusy ? <Loader2 className="h-4 w-4 animate-spin text-coral" /> : <Download className="h-4 w-4" />}
            title="Download backup"
            detail="One file with every profile, plan, photo, and ticket."
            onClick={() => void exportBackup()}
            disabled={backupBusy}
            trailing={<span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted/40">JSON</span>}
          />

          <ActionRow
            icon={<Upload className="h-4 w-4" />}
            title="Restore a backup"
            detail="Bring a backup back to life on this device."
            onClick={() => restoreInputRef.current?.click()}
            trailing={<ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
          />
        </div>

        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) setPendingRestore(file)
            event.target.value = ''
          }}
        />

        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-sun/15 bg-sun/[0.05] px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
          <p className="text-[11px] font-semibold leading-relaxed text-muted">
            Everything lives in this browser. Clearing site data, using private mode, or losing the
            device takes it with you. A backup is your best friend.
          </p>
        </div>
      </section>

      <InstallCard />

      <section className="mt-8">
        <SectionHeading title="Danger zone" />
        <div className="surface overflow-hidden">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-punch/[0.05]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-punch/15 bg-punch/[0.07] text-punch">
              <Trash2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-cream">Delete this profile</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-muted">
                Remove {profile.name}'s trips, plans, photos, and tickets from this device.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </div>
      </section>

      <footer className="mt-10 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-8 pb-2 text-center">
        <Wordmark markSize={26} />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted/50">
          Version 1.1 · Local-first, good-days-first
        </p>
      </footer>

      {editOpen ? (
        <Sheet
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          title="Edit profile"
          description="A name and a color. That's all it takes."
        >
          <ProfileForm
            initialName={profile.name}
            initialColor={profile.color}
            submitLabel="Save profile"
            onCancel={() => setEditOpen(false)}
            onSubmit={async (name, color) => {
              await updateProfile(profile.id, name, color)
              setEditOpen(false)
              toast('Profile updated.', 'success')
            }}
          />
        </Sheet>
      ) : null}

      {addOpen ? (
        <Sheet
          open
          onOpenChange={(open) => !open && setAddOpen(false)}
          title="Add a profile"
          description="Another space for another person — still on this device."
        >
          <ProfileForm
            submitLabel="Add profile"
            onCancel={() => setAddOpen(false)}
            onSubmit={async (name, color) => {
              await createProfile(name, color)
              setAddOpen(false)
              toast('New profile ready.', 'success')
            }}
          />
        </Sheet>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this profile?"
        description={`All of ${profile.name}'s trips, plans, photos, and tickets will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete profile"
        destructive
        onConfirm={async () => {
          await deleteProfile(profile.id)
          toast('Profile deleted.', 'success')
        }}
      >
        <div className="rounded-2xl border border-punch/15 bg-punch/[0.05] p-4">
          <p className="text-sm font-semibold leading-relaxed text-muted">
            {pluralize(tripCount, 'trip')} and {pluralize(planCount, 'plan')} will go with it. If you want
            a safety net, download a backup first.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title="Restore this backup?"
        description="This replaces everything currently in Jaunt on this device — every profile, trip, plan, photo, and ticket."
        confirmLabel="Restore backup"
        destructive
        onConfirm={restore}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <p className="text-sm font-semibold leading-relaxed text-muted">
            The backup will be loaded exactly as it was exported. Anything added since then will be
            replaced.
          </p>
        </div>
      </ConfirmDialog>
    </Page>
  )
}
