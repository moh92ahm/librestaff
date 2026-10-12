'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollTable, payrollSettingsTable } from '@/db/schema'

type Payroll = InferSelectModel<typeof payrollTable>
type PayrollSetting = InferSelectModel<typeof payrollSettingsTable>
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFormatter, useTranslations } from 'next-intl'

interface PayrollCardProps {
  payrollHistory?: Payroll[]
  payrollSettings?: PayrollSetting[]
}

export function PayrollCard({ payrollHistory = [], payrollSettings = [] }: PayrollCardProps) {
  const t = useTranslations('payroll')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const paymentMethodT = useTranslations('labels.paymentMethods')
  const frequencyT = useTranslations('labels.frequencies')
  const monthT = useTranslations('labels.months')
  const format = useFormatter()
  // Format currency
  const formatCurrency = (amount: number | undefined) => {
    if (!amount && amount !== 0) return t('notSet')
    return format.number(amount, {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  // Get status variant
  const getStatusVariant = (
    status: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'approved':
        return 'secondary'
      case 'cancelled':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Payment history table columns
  const historyColumns = [
    {
      key: 'month' as keyof Payroll,
      header: t('period'),
      render: (value: unknown, item: Payroll) => {
        const month = item.month
        const year = item.year
        if (!month || !year) return '-'
        return `${monthT(month as any)} ${year}`
      },
    },
    {
      key: 'payrollItems' as keyof Payroll,
      header: t('paymentMethod'),
      render: (value: unknown, item: Payroll) => {
        const items = item.payrollItems
        const isAdditionalPayment = (item as any).isAdditionalPayment

        if (!items || !Array.isArray(items) || items.length === 0) return '-'

        // Get all unique payment types
        const paymentTypes = items
          .map((payrollItem) => (payrollItem as any).paymentType)
          .filter((type, index, self) => type && self.indexOf(type) === index)

        if (paymentTypes.length === 0) return '-'

        return (
          <div className="flex flex-wrap gap-1">
            {paymentTypes.map((type, idx) => {
              const label = paymentMethodT(type as any)
              // Show "Additional" badge if it's from additional-payments collection
              // OR if it's a secondary item in payrollItems array
              const showAdditional = isAdditionalPayment || (items.length > 1 && idx > 0)
              return (
                <div key={idx} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {label}
                  </Badge>
                  {showAdditional && (
                    <Badge variant="secondary" className="text-xs">
                      {t('additional')}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      id: 'amount',
      key: 'totalAmount' as keyof Payroll,
      header: t('amount'),
      render: (value: unknown, item: Payroll) => {
        const items = item.payrollItems
        if (!items || !Array.isArray(items) || items.length === 0) return formatCurrency(0)

        // Calculate base amount from all payroll items
        const baseAmount = items.reduce((sum, payrollItem) => {
          return sum + ((payrollItem as any).amount || 0)
        }, 0)

        const bonus = Number(item.bonusAmount || 0)
        const deduction = Number(item.deductionAmount || 0)

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
      id: 'netTotal',
      key: 'totalAmount' as keyof Payroll,
      header: t('netTotal'),
      render: (value: unknown, item: Payroll) => {
        return <span className="font-medium">{formatCurrency(Number(item.totalAmount) || 0)}</span>
      },
    },
    {
      key: 'status' as keyof Payroll,
      header: commonT('status'),
      render: (value: unknown) => (
        <Badge variant={getStatusVariant(String(value))} className="capitalize">
          {statusT(String(value) as any)}
        </Badge>
      ),
    },
  ]

  // Payroll settings table columns
  const settingsColumns = [
    {
      key: 'description' as keyof PayrollSetting,
      header: t('description'),
      render: (value: unknown) => String(value) || '-',
    },
    {
      key: 'amount' as keyof PayrollSetting,
      header: t('amount'),
      render: (value: unknown, item: PayrollSetting) => {
        return formatCurrency(Number(item.amount))
      },
    },
    {
      key: 'paymentType' as keyof PayrollSetting,
      header: t('paymentMethod'),
      render: (value: unknown, item: PayrollSetting) => {
        const paymentType = item.paymentType
        return paymentType ? paymentMethodT(paymentType as any) : '-'
      },
    },
    {
      key: 'paymentFrequency' as keyof PayrollSetting,
      header: t('frequency'),
      render: (value: unknown, item: PayrollSetting) => {
        const freq = item.paymentFrequency
        return freq ? frequencyT(freq as any) : '-'
      },
    },
    {
      key: 'isActive' as keyof PayrollSetting,
      header: commonT('status'),
      render: (value: unknown) => {
        const isActive = Boolean(value)
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? commonT('active') : commonT('inactive')}
          </Badge>
        )
      },
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">{t('information')}</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            <TabsTrigger value="history">{t('history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{t('activeConfigurations')}</p>
            {payrollSettings.length > 0 ? (
              <div className="w-full overflow-auto">
                <DataTable<PayrollSetting>
                  data={payrollSettings}
                  columns={settingsColumns}
                  enablePagination={false}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noSettings')}</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{t('historicalRecords')}</p>
            {payrollHistory.length > 0 ? (
              <div className="w-full overflow-auto">
                <DataTable<Payroll>
                  data={payrollHistory}
                  columns={historyColumns}
                  enablePagination={false}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
