import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { db } from '@/db'
import type { Activity, Trip } from '@/types'
import { sortActivities } from '@/lib/dates'
import { reorderDay, setActivityCompleted } from '@/lib/repo'
import { useActivityViews } from '@/context/ActivityViews'
import { useToast } from '@/context/ToastContext'
import { ActivityCard } from './ActivityCard'

interface PlanListProps {
  profileId: string
  date: string
  activities: Activity[]
  tripsById: Map<string, Trip>
  empty?: ReactNode
  sortable?: boolean
}

export function PlanList({
  profileId,
  date,
  activities,
  tripsById,
  empty,
  sortable = true,
}: PlanListProps) {
  const { openDetail } = useActivityViews()
  const { toast } = useToast()
  const sorted = useMemo(() => sortActivities(activities), [activities])
  const signature = activities.map((activity) => `${activity.id}:${activity.sortOrder}:${activity.updatedAt}`).join('|')
  const [items, setItems] = useState<Activity[]>(sorted)
  const ids = activities.map((activity) => activity.id)
  const idsKey = [...ids].sort().join('|')

  useEffect(() => {
    setItems(sortActivities(activities))
    // The signature captures order and content updates without resetting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const attachmentCounts = useLiveQuery(
    async () => {
      if (ids.length === 0) return {}
      const rows = await db.attachments.where('activityId').anyOf(ids).toArray()
      return rows.reduce<Record<string, number>>((counts, attachment) => {
        counts[attachment.activityId] = (counts[attachment.activityId] ?? 0) + 1
        return counts
      }, {})
    },
    [idsKey],
    {} as Record<string, number>,
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggle = async (activity: Activity, completed: boolean) => {
    try {
      await setActivityCompleted(activity.id, completed)
      if (completed) {
        if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
        const remaining = activities.filter((item) => item.id !== activity.id && !item.completed).length
        if (remaining === 0) {
          toast("That's the whole day. Go enjoy it.", 'success', 4500)
        }
      }
    } catch {
      toast('Could not update that plan.', 'error')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((activity) => activity.id === active.id)
    const newIndex = items.findIndex((activity) => activity.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)

    try {
      await reorderDay(profileId, date, next.map((activity) => activity.id))
    } catch {
      setItems(sorted)
      toast('Could not reorder those plans.', 'error')
    }
  }

  if (activities.length === 0) return <>{empty}</>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
      <SortableContext items={items.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {items.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              trip={activity.tripId ? tripsById.get(activity.tripId) : undefined}
              attachmentCount={attachmentCounts[activity.id] ?? 0}
              onOpen={() => openDetail(activity.id)}
              onToggle={(completed) => void toggle(activity, completed)}
              sortable={sortable}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
