import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ACTIVE_PROFILE_KEY, db } from '@/db'
import type { Profile } from '@/types'
import {
  createProfileRecord,
  deleteProfileData,
  requestPersistentStorage,
  updateProfileRecord,
} from '@/lib/repo'
import { useAuth } from './AuthContext'

interface ProfileContextValue {
  profiles: Profile[] | undefined
  guestProfiles: Profile[] | undefined
  profile: Profile | null
  ready: boolean
  selectProfile: (id: string) => void
  createProfile: (name: string, color: string) => Promise<Profile>
  updateProfile: (id: string, name: string, color: string) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const allProfiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray(), [])
  const guestProfiles = useMemo(
    () => allProfiles?.filter((profile) => profile.kind !== 'account'),
    [allProfiles],
  )
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
    } catch {
      return null
    }
  })

  const accountProfile = useMemo<Profile | null>(() => {
    if (!user) return null
    return {
      id: user.id,
      name: user.displayName,
      color: user.color,
      createdAt: 0,
      kind: 'account',
    }
  }, [user])

  useEffect(() => {
    if (mode !== 'account' || !user) return
    let cancelled = false

    void db.profiles.get(user.id).then(async (existing) => {
      if (cancelled) return
      if (!existing) {
        await db.profiles.add({
          id: user.id,
          name: user.displayName,
          color: user.color,
          createdAt: Date.now(),
          kind: 'account',
        })
      } else if (
        existing.kind !== 'account' ||
        existing.name !== user.displayName ||
        existing.color !== user.color
      ) {
        await db.profiles.put({
          ...existing,
          name: user.displayName,
          color: user.color,
          kind: 'account',
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [mode, user])

  useEffect(() => {
    if (mode !== 'guest' || !guestProfiles) return

    if (guestProfiles.length === 0) {
      setActiveId(null)
      try {
        window.localStorage.removeItem(ACTIVE_PROFILE_KEY)
      } catch {
        // Ignore.
      }
      return
    }

    if (!activeId || !guestProfiles.some((profile) => profile.id === activeId)) {
      const next = guestProfiles[0].id
      setActiveId(next)
      try {
        window.localStorage.setItem(ACTIVE_PROFILE_KEY, next)
      } catch {
        // Ignore.
      }
    }
  }, [mode, guestProfiles, activeId])

  const selectProfile = useCallback((id: string) => {
    setActiveId(id)
    try {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, id)
    } catch {
      // Ignore.
    }
  }, [])

  const createProfile = useCallback(
    async (name: string, color: string) => {
      if (mode !== 'guest') throw new Error('Profiles are only available in offline mode.')
      const profile = await createProfileRecord(name, color)
      selectProfile(profile.id)
      void requestPersistentStorage()
      return profile
    },
    [mode, selectProfile],
  )

  const updateProfile = useCallback(
    async (id: string, name: string, color: string) => {
      if (mode !== 'guest') throw new Error('Account profiles can only be changed by the server.')
      await updateProfileRecord(id, { name, color })
    },
    [mode],
  )

  const deleteProfile = useCallback(
    async (id: string) => {
      if (mode !== 'guest') throw new Error('Sign out instead of deleting an account profile.')
      const remaining = (guestProfiles ?? []).filter((profile) => profile.id !== id)
      await deleteProfileData(id)

      if (activeId === id) {
        const next = remaining[0]?.id ?? null
        setActiveId(next)
        try {
          if (next) window.localStorage.setItem(ACTIVE_PROFILE_KEY, next)
          else window.localStorage.removeItem(ACTIVE_PROFILE_KEY)
        } catch {
          // Ignore.
        }
      }
    },
    [activeId, guestProfiles, mode],
  )

  const profile = useMemo(() => {
    if (mode === 'account') return accountProfile
    if (!guestProfiles) return null
    return guestProfiles.find((item) => item.id === activeId) ?? guestProfiles[0] ?? null
  }, [mode, accountProfile, guestProfiles, activeId])

  const profiles = useMemo(() => {
    if (mode === 'account') return accountProfile ? [accountProfile] : []
    return guestProfiles
  }, [mode, accountProfile, guestProfiles])

  const ready =
    mode === 'account' ? Boolean(user) : allProfiles !== undefined

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles,
      guestProfiles,
      profile,
      ready,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
    }),
    [
      profiles,
      guestProfiles,
      profile,
      ready,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
    ],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile must be used within ProfileProvider')
  return context
}
