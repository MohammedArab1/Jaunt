import {
  Backpack,
  BriefcaseBusiness,
  Droplets,
  Package,
  Plug,
  Shirt,
  type LucideIcon,
} from 'lucide-react'
import type { PackingCategory } from '@/types'

export const PACKING_ICONS: Record<PackingCategory, LucideIcon> = {
  documents: BriefcaseBusiness,
  clothing: Shirt,
  toiletries: Droplets,
  electronics: Plug,
  gear: Backpack,
  other: Package,
}

export const PACKING_TONES: Record<PackingCategory, string> = {
  documents: 'border-sky/20 bg-sky/10 text-sky',
  clothing: 'border-coral/20 bg-coral/10 text-coral',
  toiletries: 'border-mint/20 bg-mint/10 text-mint',
  electronics: 'border-violet/20 bg-violet/10 text-violet',
  gear: 'border-sun/20 bg-sun/10 text-sun',
  other: 'border-fg/25 bg-fg/10 text-fg',
}
