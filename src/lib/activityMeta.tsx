import {
  BedDouble,
  PartyPopper,
  Plane,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityType } from '@/types'

export interface ActivityMeta {
  label: string
  color: string
  icon: LucideIcon
}

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  flight: { label: 'Flight', color: '#5EC8FF', icon: Plane },
  lodging: { label: 'Stay', color: '#A98BFF', icon: BedDouble },
  food: { label: 'Food', color: '#FF9F45', icon: UtensilsCrossed },
  experience: { label: 'Experience', color: '#4ADE97', icon: Ticket },
  transport: { label: 'Transport', color: '#45E0D0', icon: TrainFront },
  event: { label: 'Event', color: '#FF5C8A', icon: PartyPopper },
  shopping: { label: 'Shopping', color: '#FFD166', icon: ShoppingBag },
  other: { label: 'Other', color: '#B7B0C5', icon: Sparkles },
}

export const ACTIVITY_TYPE_ORDER: ActivityType[] = [
  'experience',
  'food',
  'flight',
  'lodging',
  'transport',
  'event',
  'shopping',
  'other',
]

export function activityMeta(type: ActivityType): ActivityMeta {
  return ACTIVITY_META[type] ?? ACTIVITY_META.other
}
