import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requirePermission } from '@/lib/permissions'
import { inventoryTable } from '@/db/schema'
import { InventoryForm } from '@/components/inventory/forms/inventory-form'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { eq } from 'drizzle-orm'
import { hydrateInventoryImages } from '@/lib/inventory-media'
import { getInventoryHolderOptions, updateInventory } from '@/lib/actions/inventory'

interface EditInventoryPageProps {
  params: Promise<{ id: string }>
}

export default async function EditInventoryPage({ params }: EditInventoryPageProps) {
  const { id } = await params
  await requirePermission('inventory', 'edit')

  const item = await db.query.inventoryTable.findFirst({
    where: eq(inventoryTable.id, id),
    with: {
      holder: true,
    },
  })

  if (!item) {
    notFound()
  }

  const users = await getInventoryHolderOptions('edit', item.holderId)
  const handleUpdate = updateInventory.bind(null, id)

  return (
    <>
      <SetBreadcrumbLabel label={item.itemType} />
      <InventoryForm
        mode="edit"
        initialData={(await hydrateInventoryImages([item]))[0]}
        formAction={handleUpdate}
        holders={users.map((u) => ({ value: String(u.id), label: u.fullName }))}
      />
    </>
  )
}
