import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requirePermission } from '@/lib/permissions'
import { inventoryLogsTable, inventoryTable } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { hydrateInventoryImages } from '@/lib/inventory-media'
import {
  InventoryDetailView,
  type InventoryDetailLog,
} from '@/components/inventory/inventory-detail-view'
import type { Metadata } from 'next'

interface InventoryDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ logPage?: string }>
}

export async function generateMetadata({ params }: InventoryDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const item = await db.query.inventoryTable.findFirst({
    where: eq(inventoryTable.id, id),
    columns: { model: true, serialNumber: true },
  })
  if (!item) return { title: 'Inventory Item' }
  return { title: `${item.model} - ${item.serialNumber}` }
}

export default async function InventoryDetailPage({
  params,
  searchParams,
}: InventoryDetailPageProps) {
  const { id } = await params
  const { logPage } = await searchParams
  await requirePermission('inventory', 'view')

  const LOG_PAGE_SIZE = 10
  const currentPage = Math.max(1, parseInt(logPage ?? '1', 10) || 1)

  const rawItem = await db.query.inventoryTable.findFirst({
    where: eq(inventoryTable.id, id),
    with: { holder: { columns: { fullName: true } } },
  })

  if (!rawItem) notFound()

  const [item] = await hydrateInventoryImages([rawItem])

  let logs: InventoryDetailLog[] = []
  let logTotal = 0

  try {
    const [logsResult, countResult] = await Promise.all([
      db.query.inventoryLogsTable.findMany({
        where: eq(inventoryLogsTable.inventoryId, id),
        with: { actor: { columns: { fullName: true } } },
        orderBy: [desc(inventoryLogsTable.createdAt)],
        limit: LOG_PAGE_SIZE,
        offset: (currentPage - 1) * LOG_PAGE_SIZE,
      }),
      db
        .select({ total: count() })
        .from(inventoryLogsTable)
        .where(eq(inventoryLogsTable.inventoryId, id)),
    ])

    logs = logsResult
    logTotal = countResult[0]?.total ?? 0
  } catch {
    // Log table may not be migrated in every local environment yet.
  }

  return (
    <InventoryDetailView
      item={item}
      logs={logs}
      logTotal={logTotal}
      currentPage={currentPage}
      pageSize={LOG_PAGE_SIZE}
    />
  )
}
