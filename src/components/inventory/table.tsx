'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { InferSelectModel } from 'drizzle-orm'
import { inventoryTable, usersTable } from '@/db/schema'
import { Badge } from '../ui/badge'
import { DataTable } from '../data-table'
import { Button } from '../ui/button'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate } from '@/lib/date-utils'
import { updateInventoryInline } from '@/lib/actions/inventory'
import { notify } from '@/lib/notify'
import { Eye, Search, ChevronDown, Pencil } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'

type Inventory = InferSelectModel<typeof inventoryTable> & {
  holder?: User | null
}
type User = InferSelectModel<typeof usersTable>

interface InventoryTableProps {
  data: Inventory[]
  enablePagination?: boolean
  canViewItems?: boolean
  canEditItems?: boolean
  canInlineEdit?: boolean
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  inUse: 'default',
  inStock: 'secondary',
  needsRepair: 'destructive',
  underRepair: 'outline',
}

// ─── Inline Status Select ────────────────────────────────────────────────────

function InlineStatusSelect({ item }: { item: Inventory }) {
  const router = useRouter()
  const enumT = useTranslations('enums')
  const t = useTranslations('inventory')
  const [status, setStatus] = React.useState(item.status)
  const [saving, setSaving] = React.useState(false)

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return
    const prev = status
    setStatus(newStatus as typeof status)
    setSaving(true)
    try {
      await updateInventoryInline(String(item.id), {
        status: newStatus,
        ...(newStatus !== 'inUse' ? { holder: null } : {}),
      })
      notify.success(t('inventoryUpdated'))
      router.refresh()
    } catch (err) {
      setStatus(prev)
      notify.error(err, t('inventoryUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  let label: string
  try {
    label = enumT(`inventoryStatus.${status}` as any)
  } catch {
    label = status
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-7 w-auto border-0 bg-transparent px-0 shadow-none focus:ring-0 [&>[aria-hidden='true']]:hidden">
        <SelectValue>
          <Badge
            variant={STATUS_VARIANTS[status] ?? 'default'}
            className="pointer-events-none flex items-center gap-1"
          >
            {label}
            <ChevronDown className="size-3 opacity-70" />
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="inUse">{enumT('inventoryStatus.inUse')}</SelectItem>
        <SelectItem value="inStock">{enumT('inventoryStatus.inStock')}</SelectItem>
        <SelectItem value="needsRepair">{enumT('inventoryStatus.needsRepair')}</SelectItem>
        <SelectItem value="underRepair">{enumT('inventoryStatus.underRepair')}</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ─── Inline Holder Select ────────────────────────────────────────────────────

function InlineHolderSelect({ item }: { item: Inventory }) {
  const router = useRouter()
  const t = useTranslations('inventory')
  const common = useTranslations('common')
  const [holderId, setHolderId] = React.useState<string>(
    item.holder && typeof item.holder === 'object' ? String(item.holder.id) : item.holderId || '',
  )
  const [holderLabel, setHolderLabel] = React.useState<string>(
    item.holder && typeof item.holder === 'object' && 'fullName' in item.holder
      ? item.holder.fullName
      : '',
  )
  const [holders, setHolders] = React.useState<Array<{ value: string; label: string }>>([])
  const [query, setQuery] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/users/options')
      .then((r) => r.json())
      .then((d) => setHolders(d.options ?? []))
      .catch(() => {})
  }, [])

  const filtered = React.useMemo(() => {
    if (!query) return holders
    const q = query.toLowerCase()
    return holders.filter((h) => h.label.toLowerCase().includes(q))
  }, [holders, query])

  const handleChange = async (newId: string) => {
    const resolvedId = newId === '__none__' ? '' : newId
    const prev = { holderId, holderLabel }
    const newLabel = holders.find((h) => h.value === resolvedId)?.label ?? ''
    setHolderId(resolvedId)
    setHolderLabel(newLabel)
    setSaving(true)
    try {
      await updateInventoryInline(String(item.id), { holder: resolvedId || null })
      notify.success(t('inventoryUpdated'))
      router.refresh()
    } catch (err) {
      setHolderId(prev.holderId)
      setHolderLabel(prev.holderLabel)
      notify.error(err, t('inventoryUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select value={holderId || '__none__'} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-7 w-auto border-0 bg-transparent px-0 shadow-none focus:ring-0 [&>[aria-hidden='true']]:hidden">
        <SelectValue>
          <span className="flex items-center gap-1 text-sm">
            {holderLabel || <span className="text-muted-foreground">{t('unassigned')}</span>}
            <ChevronDown className="size-3 opacity-50" />
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="flex items-center border-b px-3 pb-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder={common('search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full border-0 bg-transparent p-0 placeholder:text-muted-foreground focus-visible:ring-0"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-[200px] overflow-auto">
          <SelectItem value="__none__">{t('unassigned')}</SelectItem>
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {common('noResults')}
            </div>
          ) : (
            filtered.map((h) => (
              <SelectItem key={h.value} value={h.value}>
                {h.label}
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  )
}

function InventoryStatusBadge({ status }: { status: string }) {
  const enumT = useTranslations('enums')

  let label: string
  try {
    label = enumT(`inventoryStatus.${status}` as any)
  } catch {
    label = status
  }

  return <Badge variant={STATUS_VARIANTS[status] ?? 'default'}>{label}</Badge>
}

function HolderLabel({ item }: { item: Inventory }) {
  const t = useTranslations('inventory')
  const holderName =
    item.holder && typeof item.holder === 'object' && 'fullName' in item.holder
      ? item.holder.fullName
      : ''

  return holderName ? (
    <span>{holderName}</span>
  ) : (
    <span className="text-muted-foreground">{t('unassigned')}</span>
  )
}

// ─── Main Table ──────────────────────────────────────────────────────────────

export function InventoryTable({
  data,
  enablePagination = true,
  canViewItems = false,
  canEditItems = false,
  canInlineEdit = false,
}: InventoryTableProps) {
  const t = useTranslations('inventory')
  const locale = useLocale()
  const enumT = useTranslations('enums')
  const common = useTranslations('common')
  const hasActions = canViewItems || canEditItems

  const columns = [
    {
      key: 'itemType' as keyof Inventory,
      header: t('itemType'),
      render: (value: unknown, item: Inventory) => {
        const label = (() => {
          try {
            return enumT(`inventoryType.${item.itemType}` as any)
          } catch {
            return String(value)
          }
        })()

        return canViewItems ? (
          <Link
            href={`/inventory/${item.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {label}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{label}</span>
        )
      },
    },
    {
      key: 'model' as keyof Inventory,
      header: t('model'),
    },
    {
      key: 'holder' as keyof Inventory,
      header: t('holder'),
      render: (_: unknown, item: Inventory) =>
        canInlineEdit ? <InlineHolderSelect item={item} /> : <HolderLabel item={item} />,
    },
    {
      key: 'status' as keyof Inventory,
      header: common('status'),
      render: (_: unknown, item: Inventory) =>
        canInlineEdit ? (
          <InlineStatusSelect item={item} />
        ) : (
          <InventoryStatusBadge status={item.status} />
        ),
    },
    {
      key: 'serialNumber' as keyof Inventory,
      header: t('serialNumber'),
    },
    {
      key: 'purchaseDate' as keyof Inventory,
      header: t('purchasedAt'),
      render: (value: unknown) => {
        const date = value as string
        return date ? formatDate(date, locale) : '-'
      },
    },
  ]

  const actionColumn = hasActions
    ? (item: Inventory) => {
        const viewLabel = `${t('itemDetails')}: ${item.model}`
        const editLabel = `${t('editItem')}: ${item.model}`

        return (
          <div className="flex items-center gap-2">
            {canViewItems && (
              <Button
                asChild
                variant="outline"
                size="icon-sm"
                title={viewLabel}
                aria-label={viewLabel}
              >
                <Link href={`/inventory/${item.id}`}>
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">{viewLabel}</span>
                </Link>
              </Button>
            )}
            {canEditItems && (
              <Button
                asChild
                variant="outline"
                size="icon-sm"
                title={editLabel}
                aria-label={editLabel}
              >
                <Link href={`/inventory/${item.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{editLabel}</span>
                </Link>
              </Button>
            )}
          </div>
        )
      }
    : undefined

  return (
    <div className="space-y-4">
      <DataTable<Inventory>
        data={data as Inventory[]}
        columns={columns}
        actionColumn={actionColumn}
        enablePagination={enablePagination}
      />
    </div>
  )
}
