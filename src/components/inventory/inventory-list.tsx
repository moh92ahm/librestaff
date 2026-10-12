'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { inventoryTable, usersTable } from '@/db/schema'
import { useTranslations } from 'next-intl'

type Inventory = InferSelectModel<typeof inventoryTable> & {
  holder?: User | null
}
type User = InferSelectModel<typeof usersTable>
import { InventoryTable } from '@/components/inventory/table'
import {
  allInventoryStatuses,
  allInventoryTypes,
  InventoryFilter,
  type InventoryStatusFilter,
  type InventoryTypeFilter,
} from '@/components/inventory/inventory-filter'

interface InventoryListProps {
  data: Inventory[]
  canCreate?: boolean
  canViewItems?: boolean
  canEditItems?: boolean
  canInlineEdit?: boolean
}

export function InventoryList({
  data,
  canCreate = true,
  canViewItems = false,
  canEditItems = false,
  canInlineEdit = false,
}: InventoryListProps) {
  const t = useTranslations('inventory')
  const common = useTranslations('common')
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<InventoryStatusFilter>>(
    () => new Set(allInventoryStatuses),
  )
  const [selectedTypes, setSelectedTypes] = React.useState<Set<InventoryTypeFilter>>(
    () => new Set(allInventoryTypes),
  )

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const filtered = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return data.filter((item) => {
      if (!selectedStatuses.has(item.status)) return false
      if (!selectedTypes.has(item.itemType)) return false
      const type = (item.itemType || '').toUpperCase()
      const model = (item.model || '').toUpperCase()
      const serial = (item.serialNumber || '').toUpperCase()
      const status = (item.status || '').toUpperCase()
      const holder =
        item.holder && typeof item.holder === 'object' && 'fullName' in item.holder
          ? (item.holder.fullName || '').toUpperCase()
          : ''
      if (!q) return true
      return (
        type.includes(q) ||
        model.includes(q) ||
        serial.includes(q) ||
        status.includes(q) ||
        holder.includes(q)
      )
    })
  }, [data, debounced, selectedStatuses, selectedTypes])

  const toggleType = (type: InventoryTypeFilter) => {
    setSelectedTypes((current) => {
      if (current.has(type) && current.size === 1) return current
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const toggleStatus = (status: InventoryStatusFilter) => {
    setSelectedStatuses((current) => {
      if (current.has(status) && current.size === 1) return current
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <div className="text-sm text-muted-foreground">
              {common('totalShown', { total: data.length, shown: filtered.length })}
            </div>
          </div>

          {canCreate && (
            <Link href="/inventory/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('addNewItem')}
              </Button>
            </Link>
          )}
        </div>

        {/* Filters and Search Row */}
        <div className="grid grid-cols-1 items-start justify-between gap-3 sm:grid-cols-[auto_minmax(16rem,20rem)]">
          <InventoryFilter
            selectedTypes={selectedTypes}
            selectedStatuses={selectedStatuses}
            onToggleType={toggleType}
            onToggleStatus={toggleStatus}
            onSelectAllTypes={() => setSelectedTypes(new Set(allInventoryTypes))}
            onSelectAllStatuses={() => setSelectedStatuses(new Set(allInventoryStatuses))}
          />

          {/* Search Input */}
          <Input
            placeholder={t('search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <InventoryTable
        data={filtered}
        canViewItems={canViewItems}
        canEditItems={canEditItems}
        canInlineEdit={canInlineEdit}
      />
    </div>
  )
}
