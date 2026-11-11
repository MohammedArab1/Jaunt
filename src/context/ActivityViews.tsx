import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Activity, ActivityDefaults } from '@/types'
import { ActivityDetail } from '@/components/plan/ActivityDetail'
import { ActivityEditor } from '@/components/plan/ActivityEditor'

interface EditorState {
  activity?: Activity
  defaults?: ActivityDefaults
}

interface ActivityViewsValue {
  openDetail: (activityId: string) => void
  openCreate: (defaults?: ActivityDefaults) => void
  openEdit: (activity: Activity) => void
}

const ActivityViewsContext = createContext<ActivityViewsValue | null>(null)

export function ActivityViewsProvider({ children }: { children: ReactNode }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)

  const openDetail = useCallback((activityId: string) => {
    setEditor(null)
    setDetailId(activityId)
  }, [])

  const openCreate = useCallback((defaults?: ActivityDefaults) => {
    setDetailId(null)
    setEditor({ defaults })
  }, [])

  const openEdit = useCallback((activity: Activity) => {
    setDetailId(null)
    setEditor({ activity })
  }, [])

  const value = useMemo<ActivityViewsValue>(
    () => ({ openDetail, openCreate, openEdit }),
    [openDetail, openCreate, openEdit],
  )

  return (
    <ActivityViewsContext.Provider value={value}>
      {children}

      {detailId ? (
        <ActivityDetail
          activityId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(activity) => {
            setDetailId(null)
            setEditor({ activity })
          }}
        />
      ) : null}

      {editor ? (
        <ActivityEditor
          key={editor.activity?.id ?? 'new-plan'}
          activity={editor.activity}
          defaults={editor.defaults}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </ActivityViewsContext.Provider>
  )
}

export function useActivityViews(): ActivityViewsValue {
  const context = useContext(ActivityViewsContext)
  if (!context) throw new Error('useActivityViews must be used within ActivityViewsProvider')
  return context
}
