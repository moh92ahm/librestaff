'use client'

import * as React from 'react'
import Link from 'next/link'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollSettingsTable, usersTable } from '@/db/schema'

type PayrollSetting = InferSelectModel<typeof payrollSettingsTable> & {
  employee?: User | null
}
type User = InferSelectModel<typeof usersTable>
import { Badge } from '../../ui/badge'
import { DataTable } from '../../data-table'
import { Button } from '../../ui/button'
import { Trash2 } from 'lucide-react'
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

interface PayrollSettingsTableProps {
  data: PayrollSetting[]
  enablePagination?: boolean
}

export function PayrollSettingsTable({ data, enablePagination = true }: PayrollSettingsTableProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const [deletingSetting, setDeletingSetting] = React.useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [settingToDelete, setSettingToDelete] = React.useState<PayrollSetting | null>(null)

  const handleDeleteClick = (setting: PayrollSetting) => {
    setSettingToDelete(setting)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!settingToDelete) return

    const idToDelete = settingToDelete.id
    setDeletingSetting(idToDelete)

    try {
      const response = await fetch(`/api/payroll-settings/${idToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(t('settingDeleteFailed'))
      }

      // Refresh the page to show updated data
      notify.flash('success', t('settingDeleted'))
      window.location.reload()
    } catch (error) {
      console.error('Error deleting payroll setting:', error)
      notify.error(error, t('settingDeleteFailed'))
    } finally {
      setDeletingSetting(null)
      setShowDeleteDialog(false)
      setSettingToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false)
    setSettingToDelete(null)
  }

  // Format currency
  const formatCurrency = (amount: number | undefined) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Format payment type
  const formatPaymentType = (type: string | undefined) => {
    switch (type) {
      case 'bankTransfer':
        return enumT('paymentType.bankTransfer')
      case 'cash':
        return enumT('paymentType.cash')
      case 'cheque':
        return enumT('paymentType.cheque')
      default:
        return type || '-'
    }
  }

  const formatFrequency = (frequency: string | undefined) => {
    switch (frequency) {
      case 'monthly':
        return enumT('paymentFrequency.monthly')
      case 'quarterly':
        return enumT('paymentFrequency.quarterly')
      case 'annual':
        return enumT('paymentFrequency.annual')
      default:
        return frequency || '-'
    }
  }

  const columns = [
    {
      key: 'employee' as keyof PayrollSetting,
      header: t('employee'),
      render: (value: unknown) => {
        const user = value as User
        return typeof user === 'object' && user !== null && 'fullName' in user
          ? user.fullName || '-'
          : String(value) || '-'
      },
    },
    {
      key: 'amount' as keyof PayrollSetting,
      header: t('amount'),
      render: (value: unknown, item?: PayrollSetting) => {
        const amount = item?.amount ? Number(item.amount) : undefined
        return <>{formatCurrency(amount)}</>
      },
    },
    {
      key: 'paymentFrequency' as keyof PayrollSetting,
      header: t('frequency'),
      render: (value: unknown, item: PayrollSetting) => {
        return <Badge variant="outline">{formatFrequency(item.paymentFrequency)}</Badge>
      },
    },
    {
      key: 'paymentType' as keyof PayrollSetting,
      header: t('paymentMethod'),
      render: (value: unknown, item: PayrollSetting) => {
        return <Badge variant="secondary">{formatPaymentType(item.paymentType)}</Badge>
      },
    },
    {
      key: 'description' as keyof PayrollSetting,
      header: t('description'),
      render: (value: unknown) => {
        const desc = String(value || '')
        return desc.length > 40 ? `${desc.substring(0, 40)}...` : desc || '-'
      },
    },
    {
      key: 'isActive' as keyof PayrollSetting,
      header: common('status'),
      render: (value: unknown) => {
        const isActive = Boolean(value)
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? common('active') : common('inactive')}
          </Badge>
        )
      },
    },
  ]

  const actionColumn = (item: PayrollSetting) => {
    const isDeleting = deletingSetting === item.id

    return (
      <div className="flex gap-2">
        <Link href={`/payroll/settings/${item.id}/edit`} className="flex-1">
          <Button variant="outline" className="w-full" disabled={isDeleting}>
            {t('editSetting')}
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDeleteClick(item)}
          disabled={isDeleting}
          title={t('deleteSetting')}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DataTable<PayrollSetting>
        data={data}
        columns={columns}
        actionColumn={actionColumn}
        enablePagination={enablePagination}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSettingTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteSettingDescription')}</AlertDialogDescription>
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
