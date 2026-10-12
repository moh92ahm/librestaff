import type { Metadata } from 'next'
import { db } from '@/db'
import { hasPermission, requirePermission } from '@/lib/permissions'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { InventoryList } from '@/components/inventory/inventory-list'
import { InventoryOverviewCard } from '@/components/dashboard/inventory-overview-card'
import { getInventoryStats } from '@/lib/actions/dashboard'
import { hydrateInventoryImages } from '@/lib/inventory-media'

export const metadata: Metadata = {
  title: 'Inventory',
  description: 'Manage company assets and equipment',
}

export default async function Page() {
  const user = await requirePermission('inventory', 'view')
  const [canCreateInventory, canEditInventory, inventoryStats] = await Promise.all([
    hasPermission(user, 'inventory', 'create'),
    hasPermission(user, 'inventory', 'edit'),
    getInventoryStats(),
  ])

  // Fetch inventory with holder relation
  const inventoryRows = await db.query.inventoryTable.findMany({
    orderBy: (inventory, { desc }) => [desc(inventory.updatedAt)],
    limit: 50,
    with: {
      holder: true,
    },
  })
  const inventory = await hydrateInventoryImages(inventoryRows)

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <InventoryOverviewCard stats={inventoryStats} />
          <InventoryList
            data={inventory as any}
            canCreate={canCreateInventory}
            canViewItems
            canEditItems={canEditInventory}
            canInlineEdit={canEditInventory}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
