'use client'

import * as React from 'react'
import Link from 'next/link'
import type { InferSelectModel } from 'drizzle-orm'
import { leavesTable } from '@/db/schema'

type LeaveDay = InferSelectModel<typeof leavesTable>
import { Card, CardContent, CardHeader } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { DataTable } from '../data-table'
import { Plus } from 'lucide-react'
import type { AnnualLeaveBalance } from '@/lib/leave-policy'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate } from '@/lib/date-utils'

interface LeavesCardProps {
  leaves?: LeaveDay[]
  createHref?: string
  annualBalance?: AnnualLeaveBalance
}

export function LeavesCard({
  leaves = [],
  createHref = '/leaves/new',
  annualBalance,
}: LeavesCardProps) {
  const t = useTranslations('leaves')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const leaveTypeT = useTranslations('labels.leaveTypes')
  const locale = useLocale()
  const getStatusVariant = (
    status: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'approved':
        return 'outline'
      case 'rejected':
        return 'outline'
      case 'cancelled':
        return 'outline'
      default:
        return 'default'
    }
  }

  const columns = [
    {
      key: 'type' as keyof LeaveDay,
      header: t('type'),
      render: (value: unknown) => (
        <Badge variant="secondary" className="capitalize">
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
      key: 'status' as keyof LeaveDay,
      header: commonT('status'),
      render: (value: unknown) => {
        const status = String(value)
        const isFinalStatus = ['approved', 'rejected', 'cancelled'].includes(status)

        return (
          <Badge variant={getStatusVariant(status)} className={`capitalize ${isFinalStatus}`}>
            {statusT(status as any)}
            {isFinalStatus && ' ✓'}
          </Badge>
        )
      },
    },
    {
      key: 'reason' as keyof LeaveDay,
      header: t('reason'),
      render: (value: unknown) => {
        const reason = String(value || '')
        return reason.length > 50 ? `${reason.substring(0, 50)}...` : reason
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('history')}</h2>
          <Link href={createHref}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('createRequest')}
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex">
          <div className="w-full space-y-4">
            {annualBalance && (
              <>
                <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/20 py-3 md:hidden">
                  <div className="min-w-0 px-2 text-center">
                    <p className="truncate text-xs text-muted-foreground">{t('entitled')}</p>
                    <p className="mt-1 text-lg font-semibold">{annualBalance.entitled}</p>
                  </div>
                  <div className="min-w-0 px-2 text-center">
                    <p className="truncate text-xs text-muted-foreground">{t('used')}</p>
                    <p className="mt-1 text-lg font-semibold">{annualBalance.used}</p>
                  </div>
                  <div className="min-w-0 px-2 text-center">
                    <p className="truncate text-xs text-muted-foreground">{commonT('available')}</p>
                    <p className="mt-1 text-lg font-semibold">{annualBalance.available}</p>
                  </div>
                </div>

                <div className="hidden gap-3 md:grid md:grid-cols-5">
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">{t('entitled')}</p>
                    <p className="text-xl font-semibold">{annualBalance.entitled}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">{t('used')}</p>
                    <p className="text-xl font-semibold">{annualBalance.used}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">{t('pending')}</p>
                    <p className="text-xl font-semibold">{annualBalance.pending}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">{commonT('available')}</p>
                    <p className="text-xl font-semibold">{annualBalance.available}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">{t('projected')}</p>
                    <p className="text-xl font-semibold">{annualBalance.projectedRemaining}</p>
                  </div>
                </div>
              </>
            )}
            {leaves.length > 0 ? (
              <div className="w-full overflow-auto">
                <DataTable<LeaveDay> data={leaves} columns={columns} enablePagination={false} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
