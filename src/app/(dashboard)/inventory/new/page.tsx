import type { Metadata } from 'next'
import { requirePermission } from '@/lib/permissions'
import { InventoryForm } from '@/components/inventory/forms/inventory-form'
import { createInventory, getInventoryHolderOptions } from '@/lib/actions/inventory'

// Force dynamic rendering - do not generate static page at build time
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'New Inventory',
  description: 'Add a new inventory item',
}

export default async function NewInventoryPage() {
  await requirePermission('inventory', 'create')

  const users = await getInventoryHolderOptions('create')

  return (
    <>
      <InventoryForm
        mode="create"
        formAction={createInventory}
        holders={users.map((u) => ({ value: String(u.id), label: u.fullName }))}
      />
    </>
  )
}
