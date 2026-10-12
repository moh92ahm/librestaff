'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SelectField } from '@/components/form/select-field'
import { DatePicker } from '@/components/date-picker'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollSettingsTable } from '@/db/schema'
import { useTranslations } from 'next-intl'

type PayrollSetting = InferSelectModel<typeof payrollSettingsTable>

const SettingsSchemaBase = z.object({
  employee: z.string().min(1, 'Employee is required'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0, 'Amount must be positive'),
  paymentType: z.enum(['bankTransfer', 'cash', 'cheque'], {
    error: 'Payment type is required',
  }),
  paymentFrequency: z.enum(['monthly', 'quarterly', 'annual'], {
    error: 'Payment frequency is required',
  }),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  swiftCode: z.string().optional(),
  isActive: z.boolean().default(true),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  notes: z.string().optional(),
})

const SettingsSchema = SettingsSchemaBase.superRefine((val, ctx) => {
  // Validate that end date is after start date
  if (val.endDate && val.startDate) {
    const start = new Date(val.startDate)
    const end = new Date(val.endDate)
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be after start date',
      })
    }
  }

  // Validate bank account details for bank transfer
  if (val.paymentType === 'bankTransfer') {
    if (!val.accountNumber || val.accountNumber.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountNumber'],
        message: 'Account number is required for bank transfers',
      })
    }
    if (!val.bankName || val.bankName.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankName'],
        message: 'Bank name is required for bank transfers',
      })
    }
    if (!val.accountHolderName || val.accountHolderName.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountHolderName'],
        message: 'Account holder name is required for bank transfers',
      })
    }
  }
})

export type SettingsFormValues = z.infer<typeof SettingsSchema>

interface Option {
  value: string
  label: string
  joinedAt?: string | null
}

interface SettingsFormProps {
  mode: 'create' | 'edit'
  onSubmit?: (data: SettingsFormValues) => Promise<any>
  formAction?: (formData: FormData) => Promise<void>
  employees: Option[]
  initialData?: Partial<PayrollSetting>
}

export function SettingsForm({
  mode,
  onSubmit,
  formAction,
  employees,
  initialData,
}: SettingsFormProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const {
    register,
    control,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(SettingsSchema) as any,
    defaultValues: {
      employee: initialData?.employeeId || '',
      description: initialData?.description || '',
      amount: initialData?.amount ? Number(initialData.amount) : 0,
      paymentType: (initialData?.paymentType as any) || 'bankTransfer',
      paymentFrequency:
        initialData?.paymentFrequency === 'quarterly' || initialData?.paymentFrequency === 'annual'
          ? initialData.paymentFrequency
          : 'monthly',
      accountNumber: (initialData?.bankAccount as any)?.accountNumber || '',
      bankName: (initialData?.bankAccount as any)?.bankName || '',
      accountHolderName: (initialData?.bankAccount as any)?.accountHolderName || '',
      swiftCode: (initialData?.bankAccount as any)?.swiftCode || '',
      isActive: initialData?.isActive ?? true,
      startDate: initialData?.startDate
        ? new Date(initialData.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      endDate: initialData?.endDate
        ? new Date(initialData.endDate).toISOString().split('T')[0]
        : '',
      notes: initialData?.notes || '',
    },
  })

  const formRef = React.useRef<HTMLFormElement>(null)
  const [nativeSubmitting, setNativeSubmitting] = React.useState(false)

  // Watch payment type to show/hide bank account fields
  const paymentType = watch('paymentType')
  const selectedEmployeeId = watch('employee')
  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const showBankFields = paymentType === 'bankTransfer'

  React.useEffect(() => {
    if (mode !== 'create' || dirtyFields.startDate) return

    const selectedEmployee = employees.find((employee) => employee.value === selectedEmployeeId)
    const joinedAt = selectedEmployee?.joinedAt?.split('T')[0]
    if (!joinedAt) return

    setValue('startDate', joinedAt, { shouldDirty: false, shouldValidate: true })
  }, [dirtyFields.startDate, employees, mode, selectedEmployeeId, setValue])

  const paymentTypeOptions: Option[] = [
    { label: enumT('paymentType.bankTransfer'), value: 'bankTransfer' },
    { label: enumT('paymentType.cash'), value: 'cash' },
    { label: enumT('paymentType.cheque'), value: 'cheque' },
  ]

  const paymentFrequencyOptions: Option[] = [
    { label: enumT('paymentFrequency.monthly'), value: 'monthly' },
    { label: enumT('paymentFrequency.quarterly'), value: 'quarterly' },
    { label: enumT('paymentFrequency.annual'), value: 'annual' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/payroll/settings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {common('back')}
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">
              {mode === 'create' ? t('newSetting') : t('editSetting')}
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
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('basicInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField
                  control={control}
                  name={'employee'}
                  label={`${t('employee')} *`}
                  placeholder={t('selectEmployee')}
                  options={employees}
                  searchable={true}
                  error={errors.employee?.message as string | undefined}
                />

                <div>
                  <label htmlFor="description" className="px-1 text-sm font-medium text-foreground">
                    {t('description')}
                  </label>
                  <input
                    id="description"
                    type="text"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    placeholder={t('settingDescriptionPlaceholder')}
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    className="rounded border-gray-300"
                    {...register('isActive')}
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                    {common('active')}
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="amount" className="px-1 text-sm font-medium text-foreground">
                    {t('amountTry')} *
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    {...register('amount', { valueAsNumber: true })}
                  />
                  {errors.amount && (
                    <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                  )}
                </div>

                <SelectField
                  control={control}
                  name={'paymentType'}
                  label={`${t('paymentType')} *`}
                  placeholder={t('selectPaymentType')}
                  options={paymentTypeOptions}
                  error={errors.paymentType?.message as string | undefined}
                />

                <SelectField
                  control={control}
                  name={'paymentFrequency'}
                  label={`${t('paymentFrequency')} *`}
                  placeholder={t('selectFrequency')}
                  options={paymentFrequencyOptions}
                  error={errors.paymentFrequency?.message as string | undefined}
                />
              </CardContent>
            </Card>

            {/* Bank Account Details - Only show for bank transfer */}
            {showBankFields && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t('bankAccountDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="accountNumber"
                      className="px-1 text-sm font-medium text-foreground"
                    >
                      {t('accountNumber')} *
                    </label>
                    <input
                      id="accountNumber"
                      type="text"
                      className="mt-2 w-full rounded-md border bg-background p-2"
                      {...register('accountNumber')}
                    />
                    {errors.accountNumber && (
                      <p className="text-red-500 text-sm mt-1">{errors.accountNumber.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="bankName" className="px-1 text-sm font-medium text-foreground">
                      {t('bankName')} *
                    </label>
                    <input
                      id="bankName"
                      type="text"
                      className="mt-2 w-full rounded-md border bg-background p-2"
                      {...register('bankName')}
                    />
                    {errors.bankName && (
                      <p className="text-red-500 text-sm mt-1">{errors.bankName.message}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="accountHolderName"
                      className="px-1 text-sm font-medium text-foreground"
                    >
                      {t('accountHolderName')} *
                    </label>
                    <input
                      id="accountHolderName"
                      type="text"
                      className="mt-2 w-full rounded-md border bg-background p-2"
                      {...register('accountHolderName')}
                    />
                    {errors.accountHolderName && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.accountHolderName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="swiftCode" className="px-1 text-sm font-medium text-foreground">
                      {t('swiftCode')}
                    </label>
                    <input
                      id="swiftCode"
                      type="text"
                      className="mt-2 w-full rounded-md border bg-background p-2"
                      {...register('swiftCode')}
                    />
                    {errors.swiftCode && (
                      <p className="text-red-500 text-sm mt-1">{errors.swiftCode.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Effective Dates */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('effectiveDates')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('paymentValidityHelp')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <DatePicker
                      label={`${t('startDate')} *`}
                      name="startDate"
                      value={startDate}
                      onValueChange={(value) =>
                        setValue('startDate', value, { shouldDirty: true, shouldValidate: true })
                      }
                      error={errors.startDate?.message}
                      yearRange={{ from: 2020, to: 2035 }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('paymentStartDateHelp')}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <DatePicker
                      label={t('endDate')}
                      name="endDate"
                      value={endDate}
                      onValueChange={(value) =>
                        setValue('endDate', value, { shouldDirty: true, shouldValidate: true })
                      }
                      error={errors.endDate?.message}
                      yearRange={{ from: 2020, to: 2035 }}
                      clearable
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('ongoingPaymentsHelp')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <Card className="lg:col-span-2">
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
                    rows={4}
                    className="mt-2 w-full rounded-md border bg-background p-2"
                    placeholder={t('notesPlaceholder')}
                    {...register('notes')}
                  />
                  {errors.notes && (
                    <p className="text-red-500 text-sm mt-1">{errors.notes.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Link href="/payroll/settings">
              <Button type="button" variant="outline">
                <X className="h-4 w-4 mr-2" />
                {common('cancel')}
              </Button>
            </Link>
            <Button
              type={formAction ? 'button' : 'submit'}
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
              {(isSubmitting || nativeSubmitting) && <Spinner className="mr-2" />}
              <Save className="h-4 w-4 mr-2" />
              {mode === 'create' ? common('create') : common('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
