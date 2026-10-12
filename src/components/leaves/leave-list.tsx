'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { leavesTable, usersTable } from '@/db/schema'

type LeaveDay = InferSelectModel<typeof leavesTable>
type User = InferSelectModel<typeof usersTable>
import { LeaveDayTable } from '@/components/leaves/table'
import { useTranslations } from 'next-intl'
import {
  allLeaveStatuses,
  allLeaveTypes,
  LeaveFilter,
  type LeaveStatusFilter,
  type LeaveTypeFilter,
} from '@/components/leaves/leave-filter'

interface LeaveDayProps {
  data: LeaveDay[]
  canCreate?: boolean
  canEdit?: boolean
  canUpdateStatus?: boolean
}

export function LeaveDayList({
  data,
  canCreate = true,
  canEdit = true,
  canUpdateStatus = true,
}: LeaveDayProps) {
  const t = useTranslations('leaves')
  const [query, setQuery] = React.useState('')
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<LeaveStatusFilter>>(
    () => new Set(allLeaveStatuses),
  )
  const [selectedTypes, setSelectedTypes] = React.useState<Set<LeaveTypeFilter>>(
    () => new Set(allLeaveTypes),
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.filter((item) => {
      const relatedUser = (item as LeaveDay & { user?: User | null }).user
      const user =
        relatedUser && 'fullName' in relatedUser
          ? (relatedUser.fullName || '').toLowerCase()
          : String(item.userId || '').toLowerCase()

      const itemStatus = String(item.status || '').toLowerCase()
      const itemType = String(item.type || '').toLowerCase()
      const reason = String(item.reason || '').toLowerCase()

      if (!selectedStatuses.has(item.status)) return false
      if (!selectedTypes.has(item.type)) return false

      if (!q) return true

      return (
        itemStatus.includes(q) || itemType.includes(q) || reason.includes(q) || user.includes(q)
      )
    })
  }, [data, query, selectedStatuses, selectedTypes])

  const toggleType = (type: LeaveTypeFilter) => {
    setSelectedTypes((current) => {
      if (current.has(type) && current.size === 1) return current
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const toggleStatus = (status: LeaveStatusFilter) => {
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
      {/* Header */}
      <div className="flex gap-4 sm:items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <div className="flex gap-2">
          {canCreate && (
            <Link href="/leaves/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('newLeave')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start justify-between gap-3 sm:grid-cols-[auto_minmax(16rem,20rem)]">
        <LeaveFilter
          selectedTypes={selectedTypes}
          selectedStatuses={selectedStatuses}
          onToggleType={toggleType}
          onToggleStatus={toggleStatus}
          onSelectAllTypes={() => setSelectedTypes(new Set(allLeaveTypes))}
          onSelectAllStatuses={() => setSelectedStatuses(new Set(allLeaveStatuses))}
        />
        <Input
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full"
        />
      </div>

      <LeaveDayTable data={filtered} canEdit={canEdit} canUpdateStatus={canUpdateStatus} />
    </div>
  )
}
