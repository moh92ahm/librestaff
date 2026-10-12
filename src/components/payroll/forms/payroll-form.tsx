'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollTable } from '@/db/schema'
import { useTranslations } from 'next-intl'

type Payroll = InferSelectModel<typeof payrollTable>

const PayrollSchema = z.object({
  bonusAmount: z.coerce.number().min(0, 'Bonus amount cannot be negative').optional(),
  deductionAmount: z.coerce.number().min(0, 'Deduction amount cannot be negative').optional(),
  adjustmentNote: z.string().optional(),
})

export type PayrollFormValues = z.infer<typeof PayrollSchema>

interface Option {
  value: string
  label: string
}

interface BankTransferDetail {
  id: string
  description: string
  accountNumber?: string
  bankName?: string
  accountHolderName?: string
  swiftCode?: string
}

interface PayrollFormProps {
  mode: 'create' | 'edit'
  onSubmit?: (data: PayrollFormValues) => Promise<any>
  formAction?: (formData: FormData) => Promise<void>
  employees: Option[]
  initialData?: Partial<Payroll>
  bankTransferDetails?: BankTransferDetail[]
}

export function PayrollForm({
  mode,
  onSubmit,
  formAction,
  employees,
  initialData,
  bankTransferDetails = [],
}: PayrollFormProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PayrollFormValues>({
    resolver: zodResolver(PayrollSchema) as any,
    defaultValues: {
      bonusAmount: initialData?.bonusAmount ? Number(initialData.bonusAmount) : 0,
      deductionAmount: initialData?.deductionAmount ? Number(initialData.deductionAmount) : 0,
      adjustmentNote: initialData?.adjustmentNote || '',
    },
  })

  const formRef = React.useRef<HTMLFormElement>(null)
  const [nativeSubmitting, setNativeSubmitting] = React.useState(false)

  const bonusAmount = Number(watch('bonusAmount') || 0)
  const deductionAmount = Number(watch('deductionAmount') || 0)
  const baseAmount = React.useMemo(() => {
    const items = initialData?.payrollItems
    if (!items || !Array.isArray(items)) return 0

    return items.reduce((sum, item) => sum + Number((item as any).amount || 0), 0)
  }, [initialData?.payrollItems])
  const netTotal = baseAmount + bonusAmount - deductionAmount
  const employeeName =
    employees.find((employee) => employee.value === initialData?.employeeId)?.label || '-'
  const period =
    initialData?.month && initialData?.year
      ? `${enumT(`months.${initialData.month}` as any)} ${initialData.year}`
      : '-'
  const paymentMethods = React.useMemo(() => {
    const items = initialData?.payrollItems
    if (!items || !Array.isArray(items)) return []

    return Array.from(
      new Set(
        items
          .map((item) => (item as any).paymentType)
          .filter((paymentType): paymentType is string => Boolean(paymentType)),
      ),
    )
  }, [initialData?.payrollItems])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/payroll">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {common('back')}
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">
              {mode === 'create' ? t('addPayrollRecord') : t('editPayrollRecord')}
            </h1>
          </div>
        </div>

        <form
          ref={formRef}
          action={formAction as any}
          onSubmit={!formAction ? handleSubmit(async (values) => onSubmit?.(values)) : undefined}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('basicInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyField label={t('employee')} value={employeeName} />
                <ReadOnlyField label={t('period')} value={period} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('paymentInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyField
                  label={t('paymentMethod')}
                  value={
                    paymentMethods.length > 0
                      ? paymentMethods.map((method) => enumT(`paymentType.${method}` as any)).join(', ')
                      : '-'
                  }
                />
                <ReadOnlyField label={t('amount')} value={formatCurrency(baseAmount)} />
              </CardContent>
            </Card>
          </div>

          {bankTransferDetails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('bankAccountDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankTransferDetails.map((detail) => (
                  <div
                    key={detail.id}
                    className="grid grid-cols-1 gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-2"
                  >
                    <ReadOnlyField label={t('description')} value={detail.description || '-'} />
                    <ReadOnlyField label={t('bankName')} value={detail.bankName || '-'} />
                    <ReadOnlyField
                      label={t('accountHolderName')}
                      value={detail.accountHolderName || '-'}
                    />
                    <ReadOnlyField
                      label={t('accountNumber')}
                      value={detail.accountNumber || '-'}
                    />
                    <ReadOnlyField label={t('swiftCode')} value={detail.swiftCode || '-'} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Adjustments */}
          <Card>
            <CardHeader>
              <CardTitle>{t('manualAdjustments')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bonusAmount" className="px-1 text-sm font-medium text-foreground">
                    {t('oneTimeBonus')}
                  </label>
                  <input
                    id="bonusAmount"
                    type="number"
                    step="0.01"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...register('bonusAmount', { valueAsNumber: true })}
                  />
                  {errors.bonusAmount && (
                    <p className="text-red-500 text-sm mt-1">{errors.bonusAmount.message}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="deductionAmount"
                    className="px-1 text-sm font-medium text-foreground"
                  >
                    {t('additionalDeduction')}
                  </label>
                  <input
                    id="deductionAmount"
                    type="number"
                    step="0.01"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...register('deductionAmount', { valueAsNumber: true })}
                  />
                  {errors.deductionAmount && (
                    <p className="text-red-500 text-sm mt-1">{errors.deductionAmount.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border bg-muted/30 p-4">
                <ReadOnlyField label={t('amount')} value={formatCurrency(baseAmount)} />
                <ReadOnlyField label={t('additional')} value={`+ ${formatCurrency(bonusAmount)}`} />
                <ReadOnlyField
                  label={t('additionalDeduction')}
                  value={`- ${formatCurrency(deductionAmount)}`}
                />
                <ReadOnlyField label={t('netTotal')} value={formatCurrency(netTotal)} />
              </div>

              <div>
                <label
                  htmlFor="adjustmentNote"
                  className="px-1 text-sm font-medium text-foreground"
                >
                  {t('adjustmentNotes')}
                </label>
                <textarea
                  id="adjustmentNote"
                  className="mt-2 w-full rounded-md border bg-background p-2"
                  rows={3}
                  placeholder={t('adjustmentPlaceholder')}
                  {...register('adjustmentNote')}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4 pt-4">
            <Link href="/payroll">
              <Button type="button" variant="outline" className="cursor-pointer">
                <X className="h-4 w-4 mr-2" />
                {common('cancel')}
              </Button>
            </Link>
            <Button
              type={formAction ? 'button' : 'submit'}
              className="cursor-pointer disabled:cursor-not-allowed"
              disabled={isSubmitting || nativeSubmitting}
              onClick={async () => {
                if (!formAction) return
                const isValid = await trigger()
                if (isValid) {
                  setNativeSubmitting(true)
                  formRef.current?.requestSubmit()
                }
              }}
            >
              {isSubmitting || nativeSubmitting ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSubmitting || nativeSubmitting
                ? common('saving')
                : mode === 'create'
                  ? t('createPayroll')
                  : t('updatePayroll')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">{value}</div>
    </div>
  )
}
