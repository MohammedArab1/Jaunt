import type { PackingCategory } from '@/types'

export const PACKING_CATEGORIES: Array<{ value: PackingCategory; label: string }> = [
  { value: 'documents', label: 'Documents' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'toiletries', label: 'Toiletries' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'gear', label: 'Gear' },
  { value: 'other', label: 'Other' },
]

export const PACKING_CATEGORY_ORDER = PACKING_CATEGORIES.map((category) => category.value)

export function packingCategoryLabel(category: PackingCategory): string {
  return PACKING_CATEGORIES.find((option) => option.value === category)?.label ?? 'Other'
}

export function packingCategoryRank(category: PackingCategory): number {
  const index = PACKING_CATEGORY_ORDER.indexOf(category)
  return index === -1 ? PACKING_CATEGORY_ORDER.length : index
}

export function isPackingCategory(value: unknown): value is PackingCategory {
  return typeof value === 'string' && PACKING_CATEGORY_ORDER.includes(value as PackingCategory)
}

export const PACKING_ESSENTIALS: Array<{
  name: string
  category: PackingCategory
  quantity: number
}> = [
  { name: 'Passport or ID', category: 'documents', quantity: 1 },
  { name: 'Tickets and reservations', category: 'documents', quantity: 1 },
  { name: 'Wallet and cards', category: 'documents', quantity: 1 },
  { name: 'Phone charger', category: 'electronics', quantity: 1 },
  { name: 'Headphones', category: 'electronics', quantity: 1 },
  { name: 'Toothbrush and toothpaste', category: 'toiletries', quantity: 1 },
  { name: 'Deodorant', category: 'toiletries', quantity: 1 },
  { name: 'Sunscreen', category: 'toiletries', quantity: 1 },
  { name: 'Underwear', category: 'clothing', quantity: 3 },
  { name: 'Socks', category: 'clothing', quantity: 3 },
  { name: 'T-shirts', category: 'clothing', quantity: 2 },
  { name: 'Jacket', category: 'clothing', quantity: 1 },
  { name: 'Medications', category: 'other', quantity: 1 },
  { name: 'Reusable water bottle', category: 'gear', quantity: 1 },
]
