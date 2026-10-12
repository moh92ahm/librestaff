'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectField } from '@/components/form/select-field'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useTranslations } from 'next-intl'

const AdditionalPaymentSchema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  category: z.enum(['bonus', 'advance', 'commission', 'allowance', 'other'], {
    message: 'Payment category is required',
  }),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  amount: z.coerce.number().positive('Amount must be positive'),
  paymentType: z.enum(['bankTransfer', 'cash', 'cheque'], {
    message: 'Payment type is required',
  }),
  month: z.enum(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'], {
    message: 'Month is required',
  }),
  year: z.coerce.number().min(2020).max(2030, 'Year must be between 2020 and 2030'),
  status: z.enum(['generated', 'approved', 'paid', 'cancelled']),
  notes: z.string().optional(),
  paymentDate: z.string().optional(),
})

export type AdditionalPaymentFormValues = z.infer<typeof AdditionalPaymentSchema>

interface Option {
  value: string
  label: string
}

interface AdditionalPaymentFormProps {
  formAction: (formData: FormData) => Promise<void>
  employees: Option[]
  defaultValues?: Partial<AdditionalPaymentFormValues>
  isEdit?: boolean
}

export function AdditionalPaymentForm({
  formAction,
  employees,
  defaultValues,
  isEdit = false,
}: AdditionalPaymentFormProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<AdditionalPaymentFormValues>({
    resolver: zodResolver(AdditionalPaymentSchema) as any,
    defaultValues: defaultValues || {
      employee: '',
      category: 'bonus',
      description: '',
      amount: 0,
      paymentType: 'bankTransfer',
      month: new Date().toISOString().slice(5, 7) as any,
      year: new Date().getFullYear(),
      status: 'generated',
      notes: '',
      paymentDate: '',
    },
  })

  const categoryOptions: Option[] = [
    { value: 'bonus', label: enumT('paymentCategory.bonus') },
    { value: 'advance', label: enumT('paymentCategory.advance') },
    { value: 'commission', label: enumT('paymentCategory.commission') },
    { value: 'allowance', label: enumT('paymentCategory.allowance') },
    { value: 'other', label: enumT('paymentCategory.other') },
  ]

  const paymentTypeOptions: Option[] = [
    { value: 'bankTransfer', label: enumT('paymentType.bankTransfer') },
    { value: 'cash', label: enumT('paymentType.cash') },
    { value: 'cheque', label: enumT('paymentType.cheque') },
  ]

  const monthOptions: Option[] = [
    { value: '01', label: enumT('months.01') },
    { value: '02', label: enumT('months.02') },
    { value: '03', label: enumT('months.03') },
    { value: '04', label: enumT('months.04') },
    { value: '05', label: enumT('months.05') },
    { value: '06', label: enumT('months.06') },
    { value: '07', label: enumT('months.07') },
    { value: '08', label: enumT('months.08') },
    { value: '09', label: enumT('months.09') },
    { value: '10', label: enumT('months.10') },
    { value: '11', label: enumT('months.11') },
    { value: '12', label: enumT('months.12') },
  ]

  const statusOptions: Option[] = [
    { value: 'generated', label: enumT('payrollStatus.generated') },
    { value: 'approved', label: enumT('payrollStatus.approved') },
    { value: 'paid', label: enumT('payrollStatus.paid') },
    { value: 'cancelled', label: enumT('payrollStatus.cancelled') },
  ]

  const selectedStatus = form.watch('status')
  const showPaymentDate = selectedStatus === 'paid'

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
              {isEdit ? t('editAdditionalPayment') : t('addAdditionalPayment')}
            </h1>
          </div>
        </div>

        <form action={formAction} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('basicInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField
                  control={form.control as any}
                  name="employee"
                  label={`${t('employee')} *`}
                  placeholder={t('selectEmployee')}
                  options={employees}
                  searchable={true}
                />

                <SelectField
                  control={form.control as any}
                  name="category"
                  label={`${t('paymentCategory')} *`}
                  placeholder={t('selectCategory')}
                  options={categoryOptions}
                />

                <div>
                  <label htmlFor="description" className="px-1 text-sm font-medium text-foreground">
                    {t('description')} *
                  </label>
                  <input
                    id="description"
                    type="text"
                    required
                    placeholder={t('bonusPlaceholder')}
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...form.register('description')}
                  />
                </div>

                <div>
                  <label htmlFor="amount" className="px-1 text-sm font-medium text-foreground">
                    {t('amount')} *
                  </label>
                  <input
                    id="amount"
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...form.register('amount')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField
                  control={form.control as any}
                  name="paymentType"
                  label={`${t('paymentMethod')} *`}
                  placeholder={t('selectPaymentMethod')}
                  options={paymentTypeOptions}
                />

                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    control={form.control as any}
                    name="month"
                    label={`${t('month')} *`}
                    placeholder={t('selectMonth')}
                    options={monthOptions}
                  />

                  <div>
                    <label htmlFor="year" className="px-1 text-sm font-medium text-foreground">
                      {t('year')} *
                    </label>
                    <input
                      id="year"
                      type="number"
                      required
                      min="2020"
                      max="2030"
                      className="mt-2 w-full rounded-md border bg-background p-2"
                      {...form.register('year', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <SelectField
                  control={form.control as any}
                  name="status"
                  label={`${common('status')} *`}
                  placeholder={t('selectStatus')}
                  options={statusOptions}
                />
              </CardContent>
            </Card>
          </div>

          {/* Payment Tracking */}
          {showPaymentDate && (
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentTracking')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="paymentDate" className="px-1 text-sm font-medium text-foreground">
                    {t('paymentDate')}
                  </label>
                  <input
                    id="paymentDate"
                    type="date"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...form.register('paymentDate')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>{t('additionalNotes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <label htmlFor="notes" className="px-1 text-sm font-medium text-foreground">
                  {t('notes')}
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder={t('notesPlaceholder')}
                  className="mt-2 w-full rounded-md border bg-background p-2"
                  {...form.register('notes')}
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
              type="submit"
              className="cursor-pointer disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {common('saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEdit ? t('updatePayment') : t('createPayment')}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AdditionalPaymentForm
