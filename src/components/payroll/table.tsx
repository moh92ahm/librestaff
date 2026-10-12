'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollTable, usersTable } from '@/db/schema'

type Payroll = InferSelectModel<typeof payrollTable>
type User = InferSelectModel<typeof usersTable>

type PayrollWithEmployee = Payroll & {
  employee?: User | null
  processedBy?: User | null
}

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { ChevronDown, Trash2 } from 'lucide-react'
import { notify } from '@/lib/notify'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTranslations } from 'next-intl'

interface PayrollTableProps {
  data: PayrollWithEmployee[]
  enablePagination?: boolean
}

type ExpandedPayroll = PayrollWithEmployee & {
  currentItemIndex?: number
  originalId?: string | number
}

type PayrollStatus = 'generated' | 'approved' | 'paid' | 'cancelled'

export function PayrollTable({ data, enablePagination = true }: PayrollTableProps) {
  const router = useRouter()
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const [updatingStatus, setUpdatingStatus] = React.useState<string | null>(null)
  const [deletingPayroll, setDeletingPayroll] = React.useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [payrollToDelete, setPayrollToDelete] = React.useState<Payroll | null>(null)
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = React.useState<PayrollStatus>('approved')
  const [bulkUpdating, setBulkUpdating] = React.useState(false)
  const [showBulkConfirmDialog, setShowBulkConfirmDialog] = React.useState(false)

  const getRowKey = (item: Payroll | ExpandedPayroll) => String(item.id)

  const isAdditionalPayment = (item: Payroll | ExpandedPayroll | undefined) =>
    Boolean((item as any)?.isAdditionalPayment)

  const getActualRowId = (item: Payroll | ExpandedPayroll) => {
    const idString = String(item.id)
    return isAdditionalPayment(item) && idString.startsWith('additional-')
      ? idString.replace('additional-', '')
      : idString
  }

  const getActualId = (item: Payroll | ExpandedPayroll | undefined, fallbackId: string) => {
    const idString = String(item?.id || fallbackId)
    return isAdditionalPayment(item) && idString.startsWith('additional-')
      ? idString.replace('additional-', '')
      : fallbackId
  }

  const getStatusEndpoint = (item: Payroll | ExpandedPayroll | undefined, actualId: string) => {
    return isAdditionalPayment(item)
      ? `/api/additional-payments/${actualId}/status`
      : `/api/payroll/${actualId}/status`
  }

  const canSelectRow = (item: Payroll | ExpandedPayroll) => {
    const status = String(item.status) as PayrollStatus
    return status !== 'paid' && status !== 'cancelled'
  }

  const selectedSelectableRows = React.useMemo(
    () => data.filter((item) => selectedRows.has(getRowKey(item)) && canSelectRow(item)),
    [data, selectedRows],
  )

  React.useEffect(() => {
    setSelectedRows((current) => {
      const validKeys = new Set(data.filter(canSelectRow).map((item) => getRowKey(item)))
      const next = new Set(Array.from(current).filter((key) => validKeys.has(key)))
      return next.size === current.size ? current : next
    })
  }, [data])

  const getResponseError = async (response: Response) => {
    const payload = await response.json().catch(() => null)
    return typeof payload?.error === 'string' ? payload.error : t('statusUpdateFailed')
  }

  const updatePayrollStatus = async (payrollId: string, newStatus: PayrollStatus) => {
    setUpdatingStatus(payrollId)
    try {
      const item = data.find(
        (p) => String(p.id) === payrollId || String(p.id) === `additional-${payrollId}`,
      )
      const actualId = getActualId(item, payrollId)
      const endpoint = getStatusEndpoint(item, actualId)

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error(await getResponseError(response))
      }

      notify.success(t('statusUpdated'))
      router.refresh()
    } catch (error) {
      console.error('Error updating status:', error)
      notify.error(error, t('statusUpdateFailed'))
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (selectedSelectableRows.length === 0) return

    setBulkUpdating(true)
    try {
      const response = await fetch('/api/payroll/bulk-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: bulkStatus,
          rows: selectedSelectableRows.map((item) => ({
            id: getActualRowId(item),
            type: isAdditionalPayment(item) ? 'additionalPayment' : 'payroll',
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(await getResponseError(response))
      }

      notify.success(t('statusUpdated'))
      setSelectedRows(new Set())
      setShowBulkConfirmDialog(false)
      router.refresh()
    } catch (error) {
      console.error('Error bulk updating status:', error)
      notify.error(error, t('statusUpdateFailed'))
    } finally {
      setBulkUpdating(false)
    }
  }

  const handleDeleteClick = (payroll: Payroll) => {
    setPayrollToDelete(payroll)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!payrollToDelete) return

    const idToDelete = payrollToDelete.id
    const isAdditional = (payrollToDelete as any).isAdditionalPayment

    // Extract the actual ID for additional payments (remove 'additional-' prefix)
    const idString = String(idToDelete)
    const actualId =
      isAdditional && idString.startsWith('additional-')
        ? idString.replace('additional-', '')
        : idToDelete

    const endpoint = isAdditional
      ? `/api/additional-payments/${actualId}`
      : `/api/payroll/${actualId}`

    setDeletingPayroll(String(actualId))
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(t('deleteFailed'))
      }

      notify.success(t('deleted'))
      router.refresh()
    } catch (error) {
      console.error('Error deleting payroll:', error)
      notify.error(error, t('deleteFailed'))
    } finally {
      setDeletingPayroll(null)
      setShowDeleteDialog(false)
      setPayrollToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setPayrollToDelete(null)
  }

  const getStatusVariant = (
    status: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' => {
    switch (status) {
      case 'approved':
        return 'default'
      case 'paid':
        return 'success'
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '₺0.00'
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
  }

  const formatPeriod = (period: { month?: string; year?: number }) => {
    if (!period?.month || !period?.year) return '-'
    return `${enumT(`months.${period.month}` as any)} ${period.year}`
  }

  const statusOptions: { value: PayrollStatus; label: string }[] = [
    { value: 'generated', label: enumT('payrollStatus.generated') },
    { value: 'approved', label: enumT('payrollStatus.approved') },
    { value: 'paid', label: enumT('payrollStatus.paid') },
    { value: 'cancelled', label: enumT('payrollStatus.cancelled') },
  ]

  const statusLabel = (status: PayrollStatus) => enumT(`payrollStatus.${status}` as any)
  const bulkStatusLabel = statusLabel(bulkStatus)

  const getPayrollTypeLabel = (item: ExpandedPayroll) => {
    if (!(item as any).isAdditionalPayment) {
      return t('salary')
    }

    const category = (item as any).additionalCategory || 'other'
    return enumT(`paymentCategory.${category}` as any)
  }

  const getItemsTotal = (item: ExpandedPayroll) => {
    const items = item.payrollItems
    if (!items || !Array.isArray(items)) return 0

    return items.reduce((sum, payrollItem) => sum + Number((payrollItem as any).amount || 0), 0)
  }

  const columns = [
    {
      key: 'employee' as keyof ExpandedPayroll,
      header: t('employee'),
      render: (value: unknown, item: ExpandedPayroll) => {
        const employee = item.employee
        return typeof employee === 'object' && employee !== null && 'fullName' in employee
          ? (employee as User).fullName
          : employee || '-'
      },
    },
    {
      key: 'month' as keyof ExpandedPayroll,
      header: t('period'),
      render: (value: unknown, item: ExpandedPayroll) =>
        formatPeriod({ month: item.month, year: item.year }),
    },
    {
      key: 'processedAt' as keyof ExpandedPayroll,
      header: t('type'),
      render: (value: unknown, item: ExpandedPayroll) => (
        <Badge variant={(item as any).isAdditionalPayment ? 'secondary' : 'outline'}>
          {getPayrollTypeLabel(item)}
        </Badge>
      ),
    },
    {
      key: 'payrollItems' as keyof ExpandedPayroll,
      header: t('paymentMethod'),
      render: (value: unknown, item: ExpandedPayroll) => {
        const items = item.payrollItems
        if (!items || !Array.isArray(items) || items.length === 0) return '-'

        // Now we only have one item per payroll record
        const payrollItem = items[0]

        if (!payrollItem) return '-'

        const type = (payrollItem as any).paymentType || 'bankTransfer'
        const paymentTypeLabel = enumT(`paymentType.${type}` as any)

        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{paymentTypeLabel}</Badge>
          </div>
        )
      },
    },
    {
      key: 'totalAmount' as keyof ExpandedPayroll,
      header: t('amount'),
      render: (value: unknown, item: ExpandedPayroll) => {
        const baseAmount = getItemsTotal(item)
        const bonus = parseFloat(item.bonusAmount || '0')
        const deduction = parseFloat(item.deductionAmount || '0')

        // If no adjustments, just show the amount
        if (bonus === 0 && deduction === 0) {
          return formatCurrency(baseAmount)
        }

        // Show amount with adjustments breakdown
        const parts = [formatCurrency(baseAmount)]
        if (bonus > 0) parts.push(`+ ${formatCurrency(bonus)}`)
        if (deduction > 0) parts.push(`- ${formatCurrency(deduction)}`)

        return (
          <div className="flex flex-col">
            <span className="text-sm">{parts.join(' ')}</span>
          </div>
        )
      },
    },
    {
      key: 'bonusAmount' as keyof ExpandedPayroll,
      header: t('netTotal'),
      render: (value: unknown, item: ExpandedPayroll) => {
        const baseAmount = getItemsTotal(item)
        const bonus = parseFloat(item.bonusAmount || '0')
        const deduction = parseFloat(item.deductionAmount || '0')

        const netTotal = baseAmount + bonus - deduction

        return <span className="text-sm">{formatCurrency(netTotal)}</span>
      },
    },
    {
      key: 'status' as keyof ExpandedPayroll,
      header: common('status'),
      render: (value: unknown, item: ExpandedPayroll) => {
        const currentStatus = String(value) as PayrollStatus

        // Extract the actual numeric ID for comparison
        const idString = String(item.id)
        const actualId = idString.startsWith('additional-')
          ? idString.replace('additional-', '')
          : String(item.id)

        const isUpdating = updatingStatus === actualId
        const isLocked = currentStatus === 'paid' || currentStatus === 'cancelled'

        // If status is locked (paid or cancelled), show badge without dropdown
        if (isLocked) {
          return (
            <Badge variant={getStatusVariant(currentStatus)} className="capitalize">
              {statusLabel(currentStatus)}
            </Badge>
          )
        }

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
                  {statusLabel(currentStatus)}
                  <ChevronDown className="h-3 w-3" />
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updatePayrollStatus(actualId, option.value)}
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

  const actionColumn = (item: Payroll) => {
    // Extract the actual numeric ID
    const idString = String(item.id)
    const actualId = idString.startsWith('additional-')
      ? idString.replace('additional-', '')
      : String(item.id)

    const isDeleting = deletingPayroll === actualId
    const currentStatus = String(item.status) as PayrollStatus
    const isLocked = currentStatus === 'paid' || currentStatus === 'cancelled'
    const isAdditional = (item as any).isAdditionalPayment

    // For additional payments, show edit button linking to additional payment edit page
    if (isAdditional) {
      return (
        <div className="flex gap-2">
          {isLocked ? (
            <Button
              variant="outline"
              className="w-full flex-1 cursor-not-allowed"
              disabled
              title={t('cannotEditPayment', { status: statusLabel(currentStatus) })}
            >
              {t('editPayment')}
            </Button>
          ) : (
            <Link href={`/payroll/additional/${actualId}/edit`} className="flex-1">
              <Button
                variant="outline"
                className="w-full"
                disabled={isDeleting}
                title={t('editPayment')}
              >
                {t('editPayment')}
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteClick(item)}
            disabled={isDeleting || isLocked}
            className={isLocked ? 'cursor-not-allowed' : ''}
            title={
              isLocked
                ? t('cannotDeletePayment', { status: statusLabel(currentStatus) })
                : t('deletePayment')
            }
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      )
    }

    return (
      <div className="flex gap-2">
        {isLocked ? (
          <Button
            variant="outline"
            className="w-full flex-1 cursor-not-allowed"
            disabled
            title={t('cannotEditPayroll', { status: statusLabel(currentStatus) })}
          >
            {t('editPayroll')}
          </Button>
        ) : (
          <Link href={`/payroll/${item.id}/edit`} className="flex-1">
            <Button
              variant="outline"
              className="w-full"
              disabled={isDeleting}
              title={t('editPayroll')}
            >
              {t('editPayroll')}
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteClick(item)}
          disabled={isDeleting || isLocked}
          className={isLocked ? 'cursor-not-allowed' : ''}
          title={
            isLocked
              ? t('cannotDeletePayroll', { status: statusLabel(currentStatus) })
              : t('deletePayroll')
          }
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectedSelectableRows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {t('selectedCount', { count: selectedSelectableRows.length })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={bulkStatus}
              onValueChange={(value) => setBulkStatus(value as PayrollStatus)}
              disabled={bulkUpdating}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('bulkStatus')} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowBulkConfirmDialog(true)}
              disabled={selectedSelectableRows.length === 0 || bulkUpdating}
            >
              {bulkUpdating ? common('saving') : t('applyStatus')}
            </Button>
          </div>
        </div>
      )}
      <DataTable<ExpandedPayroll>
        data={data}
        columns={columns}
        actionColumn={actionColumn}
        enablePagination={enablePagination}
        selectable
        selectableOnMobile={false}
        isRowSelected={(item) => selectedRows.has(getRowKey(item))}
        canSelectRow={canSelectRow}
        onToggleRow={(item, checked) => {
          setSelectedRows((current) => {
            const next = new Set(current)
            const key = getRowKey(item)
            if (checked) {
              next.add(key)
            } else {
              next.delete(key)
            }
            return next
          })
        }}
        onToggleAllRows={(items, checked) => {
          setSelectedRows((current) => {
            const next = new Set(current)
            items.forEach((item) => {
              const key = getRowKey(item)
              if (checked) {
                next.add(key)
              } else {
                next.delete(key)
              }
            })
            return next
          })
        }}
      />

      <AlertDialog
        open={showBulkConfirmDialog}
        onOpenChange={(open) => {
          if (!bulkUpdating) setShowBulkConfirmDialog(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulkConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bulkConfirmDescription', {
                count: selectedSelectableRows.length,
                status: bulkStatusLabel,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdating}>{common('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleBulkStatusUpdate()
              }}
              disabled={bulkUpdating || selectedSelectableRows.length === 0}
              className={
                bulkStatus === 'cancelled'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : undefined
              }
            >
              {bulkUpdating ? common('saving') : t('applyStatus')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRecordTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteRecordDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>{common('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {common('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
