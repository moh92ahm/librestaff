'use server'

import { db } from '@/db'
import { inventoryLogsTable, inventoryTable, usersTable } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/permissions'
import {
  emitNotificationEvent,
  getUsersByIdsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'
import { setFlashToast } from '@/lib/flash-toast'
import { imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import {
  getActivityChanges,
  writeMemberActivityLog,
  writeMemberActivityLogs,
  type MemberActivityInput,
} from '@/lib/member-activity'

const INVENTORY_STATUSES = ['inUse', 'inStock', 'needsRepair', 'underRepair'] as const
const VALID_INVENTORY_STATUSES = new Set<string>(INVENTORY_STATUSES)
type InventoryStatus = (typeof INVENTORY_STATUSES)[number]
type InventoryInsert = typeof inventoryTable.$inferInsert
type InventoryRow = typeof inventoryTable.$inferSelect

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function normalizeHolder(value: string) {
  return value && value !== '__none__' ? value : null
}

async function saveInventoryImageIds(formData: FormData) {
  const imageFiles = formData
    .getAll('image')
    .filter((file): file is File => file instanceof File && file.size > 0)
  const imageIds: string[] = []

  for (const file of imageFiles) {
    const media = await saveUploadedMedia({
      file,
      category: 'inventory-images',
      allowedMimeTypes: imageMimeTypes,
      alt: file.name,
    })
    imageIds.push(media.id)
  }

  return imageIds
}

async function holderNameMap(...holderIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(holderIds.filter(Boolean))) as string[]
  if (ids.length === 0) return new Map<string, { fullName: string }>()

  const holders = await getUsersByIdsForNotifications(ids)
  return new Map(holders.map((holder) => [holder.id, holder]))
}

async function writeInventoryChangeLogs({
  previous,
  current,
  actorUserId,
}: {
  previous: InventoryRow
  current: InventoryRow
  actorUserId: string
}) {
  const holderChanged = previous.holderId !== current.holderId
  const statusChanged = previous.status !== current.status

  if (!holderChanged && !statusChanged) return { holderChanged, statusChanged }

  const holders = await holderNameMap(previous.holderId, current.holderId)

  if (statusChanged) {
    await db.insert(inventoryLogsTable).values({
      inventoryId: current.id,
      eventType: 'statusChanged',
      oldValue: previous.status,
      newValue: current.status,
      actorUserId,
    })
  }

  if (holderChanged) {
    await db.insert(inventoryLogsTable).values({
      inventoryId: current.id,
      eventType: 'holderChanged',
      oldValue: previous.holderId || null,
      newValue: current.holderId || null,
      oldLabel: previous.holderId ? holders.get(previous.holderId)?.fullName || null : null,
      newLabel: current.holderId ? holders.get(current.holderId)?.fullName || null : null,
      actorUserId,
    })
  }

  return { holderChanged, statusChanged }
}

async function writeInventoryMemberActivity({
  previous,
  current,
  actorUserId,
}: {
  previous: InventoryRow | null
  current: InventoryRow
  actorUserId: string
}) {
  const holderChanged = previous
    ? previous.holderId !== current.holderId
    : Boolean(current.holderId)
  const statusChanged = previous ? previous.status !== current.status : false
  const now = current.updatedAt || new Date().toISOString()

  if (!previous) {
    if (!current.holderId) return

    await writeMemberActivityLog({
      subjectUserId: current.holderId,
      actorUserId,
      eventType: 'inventory.assigned',
      sourceType: 'inventory',
      sourceId: current.id,
      sourceLabel: current.model,
      sourceKey: `inventory.assigned:${current.id}:${current.holderId}:created`,
      metadata: {
        model: current.model,
        serialNumber: current.serialNumber,
        status: current.status,
        linkUrl: `/inventory/${current.id}`,
      },
      createdAt: current.createdAt,
    })
    return
  }

  const activity: MemberActivityInput[] = []

  if (holderChanged) {
    if (previous.holderId) {
      activity.push({
        subjectUserId: previous.holderId,
        actorUserId,
        eventType: current.holderId ? 'inventory.reassigned_from' : 'inventory.unassigned',
        sourceType: 'inventory',
        sourceId: current.id,
        sourceLabel: current.model,
        sourceKey: `inventory.holder:${current.id}:${previous.holderId}:from:${now}`,
        metadata: {
          model: current.model,
          serialNumber: current.serialNumber,
          previousHolderId: previous.holderId,
          holderId: current.holderId,
          status: current.status,
          linkUrl: `/inventory/${current.id}`,
        },
        createdAt: now,
      })
    }

    if (current.holderId) {
      activity.push({
        subjectUserId: current.holderId,
        actorUserId,
        eventType: previous.holderId ? 'inventory.reassigned_to' : 'inventory.assigned',
        sourceType: 'inventory',
        sourceId: current.id,
        sourceLabel: current.model,
        sourceKey: `inventory.holder:${current.id}:${current.holderId}:to:${now}`,
        metadata: {
          model: current.model,
          serialNumber: current.serialNumber,
          previousHolderId: previous.holderId,
          holderId: current.holderId,
          status: current.status,
          linkUrl: `/inventory/${current.id}`,
        },
        createdAt: now,
      })
    }
  }

  if (statusChanged && current.holderId) {
    activity.push({
      subjectUserId: current.holderId,
      actorUserId,
      eventType: 'inventory.status_changed',
      sourceType: 'inventory',
      sourceId: current.id,
      sourceLabel: current.model,
      sourceKey: `inventory.status:${current.id}:${current.holderId}:${previous.status}:${current.status}:${now}`,
      metadata: {
        model: current.model,
        serialNumber: current.serialNumber,
        previousStatus: previous.status,
        status: current.status,
        linkUrl: `/inventory/${current.id}`,
      },
      createdAt: now,
    })
  }

  const detailChanges = getActivityChanges(
    previous as any,
    current as any,
    [
      { field: 'itemType', label: 'Item type' },
      { field: 'model', label: 'Model' },
      { field: 'serialNumber', label: 'Serial number' },
      { field: 'purchaseDate', label: 'Purchase date' },
      { field: 'warrantyExpiry', label: 'Warranty expiry' },
      { field: 'notes', label: 'Notes' },
      { field: 'images', label: 'Images' },
    ] as any,
  )

  if (detailChanges.length > 0 && current.holderId) {
    activity.push({
      subjectUserId: current.holderId,
      actorUserId,
      eventType: 'inventory.updated',
      sourceType: 'inventory',
      sourceId: current.id,
      sourceLabel: current.model,
      sourceKey: `inventory.updated:${current.id}:${current.holderId}:${now}`,
      metadata: {
        changes: detailChanges,
        model: current.model,
        serialNumber: current.serialNumber,
        status: current.status,
        linkUrl: `/inventory/${current.id}`,
      },
      createdAt: now,
    })
  }

  await writeMemberActivityLogs(activity)
}

async function emitInventoryUpdateNotification({
  previous,
  current,
  actorUserId,
}: {
  previous: InventoryRow
  current: InventoryRow
  actorUserId: string
}) {
  const holders = await holderNameMap(previous.holderId, current.holderId)

  await emitNotificationEvent({
    eventType: NOTIFICATION_EVENTS.inventoryUpdated,
    sourceType: 'inventory',
    sourceId: current.id,
    sourceKey: `${NOTIFICATION_EVENTS.inventoryUpdated}:inventory:${current.id}:${Date.now()}`,
    actorUserId,
    recipients: toNotificationRecipients(
      await getUsersByIdsForNotifications([previous.holderId || '', current.holderId || '']),
    ),
    payload: {
      inventoryId: current.id,
      subjectUserId: current.holderId || previous.holderId || '',
      model: current.model,
      serialNumber: current.serialNumber,
      previousStatus: previous.status,
      status: current.status,
      previousHolderId: previous.holderId,
      holderId: current.holderId,
      previousHolderName: previous.holderId ? holders.get(previous.holderId)?.fullName || '' : '',
      holderName: current.holderId ? holders.get(current.holderId)?.fullName || '' : '',
      linkUrl: '/inventory',
    },
  })
}

function validateInventoryStatus(status: string): InventoryStatus {
  if (!VALID_INVENTORY_STATUSES.has(status)) {
    throw new Error('Inventory status is invalid')
  }

  return status as InventoryStatus
}

export async function createInventory(formData: FormData) {
  const actor = await requirePermission('inventory', 'create')

  const holderId = normalizeHolder(formString(formData, 'holder'))
  const imageIds = await saveInventoryImageIds(formData)

  const data: InventoryInsert = {
    itemType: formString(formData, 'itemType') as InventoryInsert['itemType'],
    model: formString(formData, 'model'),
    serialNumber: formString(formData, 'serialNumber'),
    status: validateInventoryStatus(formString(formData, 'status')),
    holderId,
    purchaseDate: formString(formData, 'purchaseDate') || null,
    warrantyExpiry: formString(formData, 'warrantyExpiry') || null,
    notes: formString(formData, 'notes') || null,
    images: imageIds,
  }

  const [created] = await db.insert(inventoryTable).values(data).returning()
  const holders = await holderNameMap(created.holderId)

  await db.insert(inventoryLogsTable).values({
    inventoryId: created.id,
    eventType: 'created',
    newValue: created.status,
    newLabel: created.holderId ? holders.get(created.holderId)?.fullName || null : null,
    actorUserId: actor.id,
  })

  await writeInventoryMemberActivity({
    previous: null,
    current: created,
    actorUserId: actor.id,
  })

  await emitNotificationEvent({
    eventType: NOTIFICATION_EVENTS.inventoryCreated,
    sourceType: 'inventory',
    sourceId: created.id,
    actorUserId: actor.id,
    recipients: toNotificationRecipients(await getUsersByIdsForNotifications([holderId || ''])),
    payload: {
      inventoryId: created.id,
      subjectUserId: holderId || '',
      holderId: holderId || '',
      holderName: holderId ? holders.get(holderId)?.fullName || '' : '',
      model: created.model,
      serialNumber: created.serialNumber,
      status: created.status,
      linkUrl: '/inventory',
    },
  })

  await setFlashToast('success', 'Inventory item created')
  revalidatePath('/inventory')
  redirect('/inventory')
}

export async function updateInventory(id: string, formData: FormData) {
  const actor = await requirePermission('inventory', 'edit')

  const existing = await db.query.inventoryTable.findFirst({
    where: eq(inventoryTable.id, id),
  })

  if (!existing) {
    throw new Error('Inventory item not found')
  }

  const keptIds = formData.getAll('keepImageIds').map(String).filter(Boolean)
  const newIds = await saveInventoryImageIds(formData)
  const holderId = normalizeHolder(formString(formData, 'holder'))

  const data: Partial<InventoryInsert> = {
    itemType: formString(formData, 'itemType') as InventoryInsert['itemType'],
    model: formString(formData, 'model'),
    serialNumber: formString(formData, 'serialNumber'),
    status: validateInventoryStatus(formString(formData, 'status')),
    holderId,
    purchaseDate: formString(formData, 'purchaseDate') || null,
    warrantyExpiry: formString(formData, 'warrantyExpiry') || null,
    notes: formString(formData, 'notes') || null,
    images: [...keptIds, ...newIds],
    updatedAt: new Date().toISOString(),
  }

  const [updated] = await db
    .update(inventoryTable)
    .set(data)
    .where(eq(inventoryTable.id, id))
    .returning()

  const changes = await writeInventoryChangeLogs({
    previous: existing,
    current: updated,
    actorUserId: actor.id,
  })

  await writeInventoryMemberActivity({
    previous: existing,
    current: updated,
    actorUserId: actor.id,
  })

  if (changes.holderChanged || changes.statusChanged) {
    await emitInventoryUpdateNotification({
      previous: existing,
      current: updated,
      actorUserId: actor.id,
    })
  }

  await setFlashToast('success', 'Inventory item updated')
  revalidatePath('/inventory')
  revalidatePath(`/inventory/${id}`)
  redirect(`/inventory/${id}`)
}

export async function getInventoryHolderOptions(
  action: 'create' | 'edit',
  includeUserId?: string | null,
) {
  await requirePermission('inventory', action)

  const users = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.isActive, true))
    .orderBy(asc(usersTable.fullName))

  if (!includeUserId || users.some((user) => user.id === includeUserId)) return users

  const existingHolder = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, includeUserId),
    columns: { id: true, fullName: true },
  })

  return existingHolder ? [...users, existingHolder] : users
}

export async function updateInventoryInline(
  id: string,
  data: { status?: string; holder?: string | null },
) {
  const actor = await requirePermission('inventory', 'edit')

  const existing = await db.query.inventoryTable.findFirst({
    where: eq(inventoryTable.id, id),
  })

  if (!existing) {
    throw new Error('Inventory item not found')
  }

  const updateData: Partial<typeof inventoryTable.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }

  if (data.status) updateData.status = validateInventoryStatus(data.status)

  if (data.holder === null) {
    updateData.holderId = null
  } else if (data.holder) {
    const holder = await db.query.usersTable.findFirst({
      columns: { id: true },
      where: eq(usersTable.id, data.holder),
    })

    if (!holder) {
      throw new Error('Selected holder does not exist')
    }

    updateData.holderId = data.holder
  }

  const [updated] = await db
    .update(inventoryTable)
    .set(updateData)
    .where(eq(inventoryTable.id, id))
    .returning()

  const holderChanged = existing.holderId !== updated.holderId
  const statusChanged = existing.status !== updated.status

  await writeInventoryChangeLogs({
    previous: existing,
    current: updated,
    actorUserId: actor.id,
  })

  await writeInventoryMemberActivity({
    previous: existing,
    current: updated,
    actorUserId: actor.id,
  })

  if (holderChanged || statusChanged) {
    await emitInventoryUpdateNotification({
      previous: existing,
      current: updated,
      actorUserId: actor.id,
    })
  }

  revalidatePath('/inventory')
  revalidatePath(`/inventory/${id}`)
}
