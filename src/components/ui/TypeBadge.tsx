import type { ActivityType } from '@/types'
import { activityMeta } from '@/lib/activityMeta'
import { hexAlpha } from '@/lib/utils'

export function TypeBadge({ type, size = 'sm' }: { type: ActivityType; size?: 'sm' | 'md' }) {
  const meta = activityMeta(type)
  const Icon = meta.icon

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold"
      style={{ backgroundColor: hexAlpha(meta.color, 0.13), color: meta.color }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {meta.label}
    </span>
  )
}
