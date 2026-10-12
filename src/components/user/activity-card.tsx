'use client'

import * as React from 'react'
import Link from 'next/link'
import type { InferSelectModel } from 'drizzle-orm'
import {
  Activity,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  FilePenLine,
  Package,
  UserRound,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { memberActivityLogsTable } from '@/db/schema'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date-utils'

type ActivityLog = InferSelectModel<typeof memberActivityLogsTable> & {
  actor?: { fullName?: string | null } | null
}

type ActivityCardProps = {
  activity?: ActivityLog[]
  profileHref: string
  canViewLeaves?: boolean
  canViewInventory?: boolean
  canViewPayroll?: boolean
}

const PAGE_SIZE = 20

export function ActivityCard({
  activity = [],
  profileHref,
  canViewLeaves = false,
  canViewInventory = false,
  canViewPayroll = false,
}: ActivityCardProps) {
  const locale = useLocale()
  const t = useTranslations('profile.activityLog')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const [page, setPage] = React.useState(0)
  const pageCount = Math.max(1, Math.ceil(activity.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const rows = activity.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          {activity.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, activity.length)} /{' '}
              {activity.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((item) => {
              const { Icon, title, detail } = presentActivity(item, t, commonT, statusT)
              const href = getActivityHref({
                item,
                profileHref,
                canViewLeaves,
                canViewInventory,
                canViewPayroll,
              })

              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium">{title}</p>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(item.createdAt, locale)}
                      </time>
                    </div>
                    {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.actor?.fullName ? <span>{t('byActor', { name: item.actor.fullName })}</span> : null}
                      {href ? (
                        <Link href={href} className="font-medium text-foreground hover:underline">
                          {t('viewDetails')}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={safePage === 0}
            >
              {commonT('previous')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={safePage >= pageCount - 1}
            >
              {commonT('next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function presentActivity(
  item: ActivityLog,
  t: ReturnType<typeof useTranslations<'profile.activityLog'>>,
  commonT: ReturnType<typeof useTranslations<'common'>>,
  statusT: ReturnType<typeof useTranslations<'labels.statuses'>>,
) {
  const metadata = item.metadata || {}
  const changes = Array.isArray(metadata.changes) ? metadata.changes : []
  const changeLabels = changes
    .map((change) => {
      if (!change || typeof change !== 'object') return null
      const candidate = change as { label?: unknown; field?: unknown; oldValue?: unknown; newValue?: unknown }
      const field = String(candidate.field || '')
      const label = activityFieldLabel(field, candidate.label, t)
      const oldValue = formatValue(candidate.oldValue, t, commonT)
      const newValue = formatValue(candidate.newValue, t, commonT)

      if (oldValue && newValue) return t('changes.changedFromTo', { field: label, oldValue, newValue })
      if (newValue) return t('changes.setTo', { field: label, newValue })
      return t('changes.updated', { field: label })
    })
    .filter(Boolean) as string[]

  const detail = changeLabels.length === 1 ? changeLabels[0] : changeLabels.join(', ')
  const source = item.sourceLabel || ''

  switch (item.eventType) {
    case 'employee.created':
      return { Icon: UserRound, title: t('events.employeeCreated'), detail: source }
    case 'employee.deactivated':
      return { Icon: UserRound, title: t('events.employeeDeactivated'), detail: source }
    case 'employee.reactivated':
    case 'employee.activated':
      return { Icon: UserRound, title: t('events.employeeActivated'), detail: source }
    case 'employee.profile_updated':
      return { Icon: FilePenLine, title: t('events.employeeProfileUpdated'), detail }
    case 'employee.profile_field_updated':
      const fieldName = activityFieldLabel(String(metadata.field || ''), metadata.fieldLabel, t)
      return {
        Icon: FilePenLine,
        title: t('events.employeeProfileFieldUpdated', { field: fieldName }),
        detail,
      }
    case 'leave.requested':
      return { Icon: CalendarDays, title: t('events.leaveRequested'), detail: leaveDetail(metadata) }
    case 'leave.status_changed':
      return { Icon: CalendarDays, title: t('events.leaveStatusChanged'), detail: statusDetail(metadata, t, statusT) }
    case 'leave.updated':
      return { Icon: CalendarDays, title: t('events.leaveUpdated'), detail }
    case 'payroll.generated':
      return { Icon: Banknote, title: t('events.payrollGenerated'), detail: payrollDetail(metadata, t) }
    case 'payroll.created':
      return { Icon: Banknote, title: t('events.payrollCreated'), detail: payrollDetail(metadata, t) }
    case 'payroll.status_changed':
      return { Icon: Banknote, title: t('events.payrollStatusChanged'), detail: statusDetail(metadata, t, statusT) }
    case 'payroll.updated':
      return { Icon: Banknote, title: t('events.payrollUpdated'), detail }
    case 'payroll_setting.created':
      return { Icon: BriefcaseBusiness, title: t('events.payrollSettingCreated'), detail: payrollSettingDetail(metadata, t) }
    case 'payroll_setting.updated':
      return { Icon: BriefcaseBusiness, title: t('events.payrollSettingUpdated'), detail }
    case 'inventory.assigned':
      return { Icon: Package, title: t('events.inventoryAssigned'), detail: inventoryDetail(metadata) }
    case 'inventory.unassigned':
      return { Icon: Package, title: t('events.inventoryUnassigned'), detail: inventoryDetail(metadata) }
    case 'inventory.reassigned_from':
      return { Icon: Package, title: t('events.inventoryReassignedFrom'), detail: inventoryDetail(metadata) }
    case 'inventory.reassigned_to':
      return { Icon: Package, title: t('events.inventoryReassignedTo'), detail: inventoryDetail(metadata) }
    case 'inventory.status_changed':
      return { Icon: Package, title: t('events.inventoryStatusChanged'), detail: statusDetail(metadata, t, statusT) }
    case 'inventory.updated':
      return { Icon: Package, title: t('events.inventoryUpdated'), detail }
    default:
      return { Icon: Activity, title: item.eventType, detail: source || detail }
  }
}

function getActivityHref({
  item,
  profileHref,
  canViewLeaves,
  canViewInventory,
  canViewPayroll,
}: {
  item: ActivityLog
  profileHref: string
  canViewLeaves: boolean
  canViewInventory: boolean
  canViewPayroll: boolean
}) {
  const metadata = item.metadata || {}
  const linkUrl = typeof metadata.linkUrl === 'string' ? metadata.linkUrl : null

  if (item.sourceType === 'employee') return profileHref
  if (item.sourceType === 'leave') {
    if (profileHref === '/me') return '/me'
    return canViewLeaves ? linkUrl || '/leaves' : null
  }
  if (item.sourceType === 'inventory') return canViewInventory ? linkUrl || '/inventory' : null
  if (item.sourceType === 'payroll' || item.sourceType === 'payroll_setting') {
    if (profileHref === '/me') return '/me'
    return canViewPayroll ? linkUrl || '/payroll' : null
  }

  return linkUrl
}

function activityFieldLabel(
  field: string,
  fallback: unknown,
  t: ReturnType<typeof useTranslations<'profile.activityLog'>>,
) {
  const fieldKeys = new Set([
    'fullName',
    'photo',
    'birthDate',
    'primaryPhone',
    'secondaryPhone',
    'secondaryEmail',
    'address',
    'email',
    'username',
    'jobTitle',
    'joinedAt',
    'employmentStartDate',
    'employmentType',
    'employmentNote',
    'personType',
    'includeInHeadcount',
    'visibleInTeamDirectory',
    'nationality',
    'identityNumber',
    'roleId',
    'departmentId',
    'type',
    'startDate',
    'endDate',
    'totalDays',
    'autoCalculatedDays',
    'isManualDayCount',
    'manualDayCountReason',
    'status',
    'reason',
    'note',
    'bonusAmount',
    'deductionAmount',
    'adjustmentNote',
    'totalAmount',
    'employeeId',
    'description',
    'amount',
    'paymentType',
    'paymentFrequency',
    'bankAccount',
    'isActive',
    'itemType',
    'model',
    'serialNumber',
    'purchaseDate',
    'warrantyExpiry',
    'notes',
    'images',
  ])

  if (fieldKeys.has(field)) return t(`fields.${field}` as never)
  return String(fallback || field || t('fields.field'))
}

function leaveDetail(metadata: Record<string, unknown>) {
  return [metadata.leaveType, metadata.startDate, metadata.endDate]
    .filter(Boolean)
    .map(String)
    .join(' - ')
}

function payrollDetail(metadata: Record<string, unknown>, t: ReturnType<typeof useTranslations<'profile.activityLog'>>) {
  return [metadata.month, metadata.year, metadata.totalAmount ? t('details.total', { value: String(metadata.totalAmount) }) : null]
    .filter(Boolean)
    .map(String)
    .join(' ')
}

function payrollSettingDetail(metadata: Record<string, unknown>, t: ReturnType<typeof useTranslations<'profile.activityLog'>>) {
  return [metadata.description, metadata.amount ? t('details.amount', { value: String(metadata.amount) }) : null]
    .filter(Boolean)
    .map(String)
    .join(' - ')
}

function inventoryDetail(metadata: Record<string, unknown>) {
  return [metadata.model, metadata.serialNumber].filter(Boolean).map(String).join(' - ')
}

function statusDetail(
  metadata: Record<string, unknown>,
  t: ReturnType<typeof useTranslations<'profile.activityLog'>>,
  statusT: ReturnType<typeof useTranslations<'labels.statuses'>>,
) {
  const previous = metadata.previousStatus ? statusLabel(String(metadata.previousStatus), statusT) : null
  const current = metadata.status ? statusLabel(String(metadata.status), statusT) : null
  if (previous && current) return t('details.statusChanged', { previous, current })
  return current || previous || ''
}

function statusLabel(value: string, statusT: ReturnType<typeof useTranslations<'labels.statuses'>>) {
  const known = new Set([
    'active',
    'inactive',
    'requested',
    'approved',
    'rejected',
    'cancelled',
    'generated',
    'paid',
    'inUse',
    'inStock',
    'needsRepair',
    'underRepair',
  ])

  return known.has(value) ? statusT(value as never) : value
}

function formatValue(
  value: unknown,
  t: ReturnType<typeof useTranslations<'profile.activityLog'>>,
  commonT: ReturnType<typeof useTranslations<'common'>>,
) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? commonT('yes') : commonT('no')
  if (Array.isArray(value)) return t('details.itemCount', { count: value.length })
  if (typeof value === 'object') return t('details.details')
  return String(value)
}
