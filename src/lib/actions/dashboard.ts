'use server'

import { db } from '@/db'
import { usersTable, inventoryTable } from '@/db/schema'
import { eq, count, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth-guards'
import { headcountWhere } from '@/lib/people'

export interface UserStats {
  total: number
  active: number
  inactive: number
}

export interface InventoryStats {
  total: number
  byType: {
    laptops: number
    phones: number
    simCards: number
    accessories: number
    other: number
  }
  byStatus: {
    inUse: number
    inStock: number
    needsRepair: number
    underRepair: number
  }
}

export async function getUserStats(): Promise<UserStats> {
  // Check authentication
  await requireAuth()

  // Count total users
  const [totalResult] = await db.select({ count: count() }).from(usersTable).where(headcountWhere())

  // Count active users
  const [activeResult] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), headcountWhere()))

  const total = totalResult.count
  const active = activeResult.count
  const inactive = total - active

  return {
    total,
    active,
    inactive,
  }
}

export async function getInventoryStats(): Promise<InventoryStats> {
  // Check authentication
  await requireAuth()

  // Get all inventory items
  const allInventory = await db.select().from(inventoryTable)

  const total = allInventory.length

  // Count by type
  const byType = {
    laptops: 0,
    phones: 0,
    simCards: 0,
    accessories: 0,
    other: 0,
  }

  // Count by status
  const byStatus = {
    inUse: 0,
    inStock: 0,
    needsRepair: 0,
    underRepair: 0,
  }

  allInventory.forEach((item) => {
    // Count by type
    switch (item.itemType) {
      case 'laptop':
        byType.laptops++
        break
      case 'phone':
        byType.phones++
        break
      case 'simCard':
        byType.simCards++
        break
      case 'accessory':
        byType.accessories++
        break
      case 'other':
        byType.other++
        break
    }

    // Count by status
    switch (item.status) {
      case 'inUse':
        byStatus.inUse++
        break
      case 'inStock':
        byStatus.inStock++
        break
      case 'needsRepair':
        byStatus.needsRepair++
        break
      case 'underRepair':
        byStatus.underRepair++
        break
    }
  })

  return {
    total,
    byType,
    byStatus,
  }
}
