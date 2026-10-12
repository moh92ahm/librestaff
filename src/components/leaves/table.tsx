'use client'

import * as React from 'react'
import type { InferSelectModel } from 'drizzle-orm'
import { leavesTable, usersTable } from '@/db/schema'

type LeaveDay = InferSelectModel<typeof leavesTable>
type User = InferSelectModel<typeof usersTable>
import { Badge } from '../ui/badge'
import { DataTable } from '../data-table'
import { Button } from '../ui/button'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate } from '@/lib/date-utils'

interface LeaveDayTableProps {
  data: LeaveDay[]
  enablePagination?: boolean
  canEdit?: boolean
  canUpdateStatus?: boolean
}

type LeaveStatus = 'requested' | 'approved' | 'rejected' | 'cancelled'

export function LeaveDayTable({
  data,
  enablePagination = true,
  canEdit = true,
  canUpdateStatus = true,
}: LeaveDayTableProps) {
  const t = useTranslations('leaves')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const leaveTypeT = useTranslations('labels.leaveTypes')
  const locale = useLocale()
  const [updatingStatus, setUpdatingStatus] = React.useState<string | null>(null)
  const statusOptions: { value: LeaveStatus; label: string }[] = [
    { value: 'requested', label: statusT('requested') },
    { value: 'approved', label: statusT('approved') },
    { value: 'rejected', label: statusT('rejected') },
    { value: 'cancelled', label: statusT('cancelled') },
  ]

  const updateLeaveStatus = async (leaveId: string, newStatus: LeaveStatus) => {
    setUpdatingStatus(leaveId)
    try {
      const response = await fetch(`/api/leaves/${leaveId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || t('statusUpdateFailed'))
      }

      // Refresh the page to show updated data
      notify.flash('success', 'Leave status updated')
      window.location.reload()
    } catch (error) {
      console.error('Error updating leave status:', error)
      notify.error(error, t('statusUpdateFailed'))
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getStatusVariant = (
    status: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'approved':
        return 'default'
      case 'rejected':
        return 'destructive'
      case 'cancelled':
        return 'secondary'
      default:
        return 'outline'
    }
  }
  const columns = [
    {
      key: 'user' as keyof LeaveDay,
      header: t('applicant'),
      render: (value: unknown, item: LeaveDay) => {
        const user = (item as LeaveDay & { user?: User | null }).user
        return user && 'fullName' in user ? user.fullName : item.userId || '-'
      },
    },
    {
      key: 'type' as keyof LeaveDay,
      header: t('type'),
      render: (value: unknown) => (
        <Badge variant="outline" className="capitalize">
          {leaveTypeT(String(value) as any)}
        </Badge>
      ),
    },
    {
      key: 'startDate' as keyof LeaveDay,
      header: t('startDate'),
      render: (value: unknown) => {
        const date = value as string
        return date ? formatDate(date, locale) : '-'
      },
    },
    {
      key: 'endDate' as keyof LeaveDay,
      header: t('endDate'),
      render: (value: unknown) => {
        const date = value as string
        return date ? formatDate(date, locale) : '-'
      },
    },
    {
      key: 'totalDays' as keyof LeaveDay,
      header: t('days'),
      render: (value: unknown, item: LeaveDay) => (
        <div className="flex items-center gap-2">
          <span>{String(value || '-')}</span>
          {item.isManualDayCount && (
            <Badge variant="secondary" title={item.manualDayCountReason || t('manualOverride')}>
              {t('manual')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'reason' as keyof LeaveDay,
      header: t('reason'),
      render: (value: unknown) => {
        const reason = String(value || '')

        return (
          <span className="block max-w-64 truncate" title={reason}>
            {reason || '-'}
          </span>
        )
      },
    },
    {
      key: 'status' as keyof LeaveDay,
      header: commonT('status'),
      render: (value: unknown, item: LeaveDay) => {
        const currentStatus = String(value) as LeaveStatus
        const isUpdating = updatingStatus === String(item.id)

        // Final statuses that cannot be changed
        const isFinalStatus = ['approved', 'rejected', 'cancelled'].includes(currentStatus)

        // If it's a final status, just show the badge without dropdown
        if (isFinalStatus || !canUpdateStatus) {
          return (
            <Badge variant={getStatusVariant(currentStatus)} className="capitalize">
              {statusT(currentStatus)}
            </Badge>
          )
        }

        // Only show dropdown for "requested" status
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                disabled={isUpdating}
              >
                <Badge
                  variant={getStatusVariant(currentStatus)}
                  className="capitalize cursor-pointer hover:opacity-80 flex items-center gap-1"
                >
                  {statusT(currentStatus)}
                  <ChevronDown className="h-3 w-3" />
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updateLeaveStatus(String(item.id), option.value)}
                  className={`cursor-pointer capitalize ${option.value === currentStatus ? 'bg-accent' : ''}`}
                  disabled={option.value === currentStatus || isUpdating}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const actionColumn = canEdit
    ? (item: LeaveDay) => (
        <Link href={`/leaves/${item.id}/edit`} className="flex-1">
          <Button variant="outline" className="w-full">
            {t('editLeave')}
          </Button>
        </Link>
      )
    : undefined

  return (
    <div className="space-y-4">
      <DataTable<LeaveDay>
        data={data as LeaveDay[]}
        columns={columns}
        actionColumn={actionColumn}
        enablePagination={enablePagination}
      />
    </div>
  )
}
