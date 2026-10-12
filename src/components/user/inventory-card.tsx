'use client'

import type { InferSelectModel } from 'drizzle-orm'
import { inventoryTable, usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable>
type Inventory = InferSelectModel<typeof inventoryTable> & {
  holder?: User | null
}
import { Card, CardContent, CardHeader } from '../ui/card'
import { InventoryTable } from '@/components/inventory/table'
import { useTranslations } from 'next-intl'

interface InventoryCardProps {
  inventory?: Inventory[]
  canViewItems?: boolean
  canEditItems?: boolean
  canInlineEdit?: boolean
}

export function InventoryCard({
  inventory = [],
  canViewItems = false,
  canEditItems = false,
  canInlineEdit = false,
}: InventoryCardProps) {
  const t = useTranslations('inventory')
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t('assignedItems')}</h2>
      </CardHeader>
      <CardContent>
        <div className="flex">
          <div className="w-full space-y-4">
            {inventory.length > 0 ? (
              <div className="w-full overflow-auto">
                <InventoryTable
                  data={inventory}
                  enablePagination={false}
                  canViewItems={canViewItems}
                  canEditItems={canEditItems}
                  canInlineEdit={canInlineEdit}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noAssignedItems')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
