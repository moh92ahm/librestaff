'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/form/select-field'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { DateRangePicker } from '@/components/date-range-picker'
import type { InferSelectModel } from 'drizzle-orm'
import { leavesTable } from '@/db/schema'
import {
  countChargeableLeaveDays,
  DEFAULT_LEAVE_POLICY,
  type AnnualLeaveBalance,
  type LeavePolicySettings,
} from '@/lib/leave-policy'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/ui/textarea'
import { MultiFileUpload, type MultiFileUploadValue } from '@/components/ui/multi-file-upload'

type LeaveDay = InferSelectModel<typeof leavesTable>

const LeaveDaySchemaBase = z.object({
  user: z.string().min(1, 'User is required'),
  type: z.enum(['annual', 'sick', 'unpaid', 'other'] as const, {
    error: 'Leave type is required',
  }),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalDays: z.coerce.number().min(0, 'Charged days cannot be negative').optional(),
  autoCalculatedDays: z.coerce.number().min(0).optional(),
  isManualDayCount: z.string().optional(),
  manualDayCountReason: z.string().optional(),
  status: z.enum(['requested', 'approved', 'rejected', 'cancelled'] as const, {
    error: 'Status is required',
  }),
  reason: z.string().min(1, 'Reason is required'),
  note: z.string().optional(),
})

const LeaveDaySchema = LeaveDaySchemaBase.superRefine((val, ctx) => {
  // Validate date range
  if (val.startDate && val.endDate) {
    const start = new Date(val.startDate)
    const end = new Date(val.endDate)
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be after start date',
      })
    }
  }

  if (val.isManualDayCount === 'true' && !val.manualDayCountReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['manualDayCountReason'],
      message: 'Override reason is required',
    })
  }
})

export type LeaveDayFormValues = z.infer<typeof LeaveDaySchema>

interface Option {
  value: string
  label: string
}

interface LeaveDayFormProps {
  mode: 'create' | 'edit'
  onSubmit?: (data: LeaveDayFormValues) => Promise<any>
  formAction?: (formData: FormData) => Promise<void>
  users: Option[]
  initialData?: Partial<Omit<LeaveDay, 'attachments'>> & {
    attachments?: MultiFileUploadValue[]
  }
  lockedUserOption?: Option
  returnHref?: string
  policy?: LeavePolicySettings
  holidayDates?: string[]
  leaveBalances?: Record<string, AnnualLeaveBalance>
  canOverrideDays?: boolean
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  )
}

function EditRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-500">{message}</p>
}

export function LeaveDayForm({
  mode,
  onSubmit,
  formAction,
  users,
  initialData,
  lockedUserOption,
  returnHref = '/leaves',
  policy = DEFAULT_LEAVE_POLICY,
  holidayDates = [],
  leaveBalances = {},
  canOverrideDays = false,
}: LeaveDayFormProps) {
  const t = useTranslations('leaves')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const leaveTypeT = useTranslations('labels.leaveTypes')
  const defaultUserValue = React.useMemo(() => {
    if (initialData) {
      // initialData has userId field from Drizzle schema
      if (initialData.userId) {
        return String(initialData.userId)
      }
    }
    return lockedUserOption?.value ?? ''
  }, [initialData, lockedUserOption])

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeaveDayFormValues>({
    resolver: zodResolver(LeaveDaySchema) as any,
    defaultValues: {
      user: defaultUserValue,
      type: (initialData?.type as any) || 'annual',
      startDate: initialData?.startDate
        ? new Date(initialData.startDate).toISOString().split('T')[0]
        : '',
      endDate: initialData?.endDate
        ? new Date(initialData.endDate).toISOString().split('T')[0]
        : '',
      totalDays: initialData?.totalDays || undefined,
      autoCalculatedDays: initialData?.autoCalculatedDays || initialData?.totalDays || undefined,
      isManualDayCount: initialData?.isManualDayCount ? 'true' : 'false',
      manualDayCountReason: initialData?.manualDayCountReason || '',
      status: (initialData?.status as any) || 'requested',
      reason: initialData?.reason || '',
      note: initialData?.note || '',
    },
  })

  const formRef = React.useRef<HTMLFormElement>(null)
  const [nativeSubmitting, setNativeSubmitting] = React.useState(false)
  const [attachments, setAttachments] = React.useState<MultiFileUploadValue[]>(() =>
    Array.isArray(initialData?.attachments) ? initialData.attachments : [],
  )
  const [manualOverride, setManualOverride] = React.useState(Boolean(initialData?.isManualDayCount))
  const currentStatus = String(initialData?.status || 'requested')
  const isEditMode = mode === 'edit'
  const isReadOnly = isEditMode && currentStatus !== 'requested'
  const canEditCoreRequest = !isReadOnly && !isEditMode

  const selectedUserId = watch('user')
  const selectedType = watch('type')
  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const chargedDays = Number(watch('totalDays') || 0)

  const autoCalculatedDays = React.useMemo(
    () => countChargeableLeaveDays(startDate, endDate, policy, holidayDates),
    [endDate, holidayDates, policy, startDate],
  )

  const selectedBalance = selectedUserId ? leaveBalances[selectedUserId] : undefined
  const projectedRemaining =
    selectedType === 'annual' && selectedBalance
      ? selectedBalance.available - chargedDays
      : undefined

  React.useEffect(() => {
    if (lockedUserOption) {
      setValue('user', lockedUserOption.value, { shouldValidate: true })
    }
  }, [lockedUserOption, setValue])

  React.useEffect(() => {
    setValue('autoCalculatedDays', autoCalculatedDays, { shouldValidate: true })

    if (isReadOnly) {
      setValue('isManualDayCount', initialData?.isManualDayCount ? 'true' : 'false', {
        shouldValidate: true,
      })
      return
    }

    if (!manualOverride && !isReadOnly) {
      setValue('totalDays', autoCalculatedDays, { shouldValidate: true })
      setValue('isManualDayCount', 'false', { shouldValidate: true })
    } else {
      setValue('isManualDayCount', 'true', { shouldValidate: true })
    }
  }, [autoCalculatedDays, initialData?.isManualDayCount, isReadOnly, manualOverride, setValue])

  const statusOptions: Option[] = [
    { label: statusT('requested'), value: 'requested' },
    { label: statusT('approved'), value: 'approved' },
    { label: statusT('rejected'), value: 'rejected' },
    { label: statusT('cancelled'), value: 'cancelled' },
  ]

  const leaveTypeOptions: Option[] = [
    { label: leaveTypeT('annual'), value: 'annual' },
    { label: leaveTypeT('sick'), value: 'sick' },
    { label: leaveTypeT('unpaid'), value: 'unpaid' },
    { label: leaveTypeT('other'), value: 'other' },
  ]

  const statusLabel =
    statusOptions.find((option) => option.value === currentStatus)?.label || currentStatus
  const selectedUserLabel =
    lockedUserOption?.value === selectedUserId
      ? lockedUserOption.label
      : users.find((option) => option.value === selectedUserId)?.label || selectedUserId
  const selectedTypeLabel =
    leaveTypeOptions.find((option) => option.value === selectedType)?.label || selectedType

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href={returnHref}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {commonT('back')}
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">
              {mode === 'create' ? t('addRequest') : t('editRequest')}
            </h1>
          </div>
        </div>

        <form
          ref={formRef}
          action={formAction as any}
          onSubmit={!formAction ? handleSubmit(async (values) => onSubmit?.(values)) : undefined}
          className="space-y-6"
        >
          <input type="hidden" {...register('status')} value={currentStatus} />
          <input type="hidden" {...register('autoCalculatedDays')} />
          <input type="hidden" {...register('isManualDayCount')} />
          {!manualOverride && <input type="hidden" {...register('totalDays')} />}

          <EditSection title={t('requestDetails')}>
            {lockedUserOption || isEditMode ? (
              <EditRow title={t('user')} description={t('editHelp.user')}>
                <div>
                  <Input
                    id="locked-user"
                    value={selectedUserLabel}
                    readOnly
                    disabled
                    className="mt-2"
                  />
                  <input
                    type="hidden"
                    {...register('user')}
                    value={lockedUserOption?.value || selectedUserId}
                  />
                  <FieldError message={errors.user?.message as string | undefined} />
                </div>
              </EditRow>
            ) : (
              <EditRow title={t('user')} description={t('editHelp.user')}>
                <SelectField
                  control={control}
                  name={'user'}
                  placeholder={t('selectUser')}
                  options={users}
                  error={errors.user?.message as string | undefined}
                  searchable={canEditCoreRequest}
                  disabled={!canEditCoreRequest}
                />
              </EditRow>
            )}

            {isEditMode ? (
              <EditRow title={t('type')} description={t('editHelp.type')}>
                <div>
                  <Input
                    id="locked-type"
                    value={selectedTypeLabel}
                    readOnly
                    disabled
                    className="mt-2"
                  />
                  <input type="hidden" {...register('type')} value={selectedType} />
                  <FieldError message={errors.type?.message as string | undefined} />
                </div>
              </EditRow>
            ) : (
              <EditRow title={t('type')} description={t('editHelp.type')}>
                <SelectField
                  control={control}
                  name={'type'}
                  placeholder={t('selectLeaveType')}
                  options={leaveTypeOptions}
                  error={errors.type?.message as string | undefined}
                  disabled={!canEditCoreRequest}
                />
              </EditRow>
            )}

            <EditRow title={t('leaveDates')} description={t('editHelp.leaveDates')}>
              <DateRangePicker
                label={`${t('leaveDates')} *`}
                startName="startDate"
                endName="endDate"
                startValue={startDate}
                endValue={endDate}
                onStartValueChange={(value) =>
                  setValue('startDate', value, { shouldValidate: true })
                }
                onEndValueChange={(value) => setValue('endDate', value, { shouldValidate: true })}
                error={(errors.startDate?.message || errors.endDate?.message) as string | undefined}
                disabled={isReadOnly}
              />
            </EditRow>

            {isEditMode && (
              <EditRow title={commonT('status')} description={t('editHelp.status')}>
                <div>
                  <Badge variant="outline" className="capitalize">
                    {statusLabel}
                  </Badge>
                </div>
              </EditRow>
            )}

            <EditRow title={t('daySummary')} description={t('editHelp.daySummary')}>
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('calculatedDays')}</p>
                    <p className="text-2xl font-semibold">{autoCalculatedDays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('chargedDays')}</p>
                    <p className="text-2xl font-semibold">{chargedDays}</p>
                  </div>
                  {selectedBalance && selectedType === 'annual' && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">{commonT('available')}</p>
                        <p className="text-2xl font-semibold">{selectedBalance.available}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('afterRequest')}</p>
                        <p
                          className={`text-2xl font-semibold ${
                            typeof projectedRemaining === 'number' && projectedRemaining < 0
                              ? 'text-destructive'
                              : ''
                          }`}
                        >
                          {projectedRemaining}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {selectedBalance && selectedType === 'annual' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {t('entitled')}: {selectedBalance.entitled}
                    </Badge>
                    <Badge variant="outline">
                      {t('used')}: {selectedBalance.used}
                    </Badge>
                    <Badge variant="outline">
                      {t('pending')}: {selectedBalance.pending}
                    </Badge>
                  </div>
                )}

                {typeof projectedRemaining === 'number' && projectedRemaining < 0 && (
                  <p className="mt-3 text-sm text-destructive">{t('exceedsBalance')}</p>
                )}
              </div>
            </EditRow>

            {canOverrideDays && !isReadOnly && (
              <EditRow title={t('overrideChargedDays')} description={t('editHelp.override')}>
                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label htmlFor="manual-day-count">{t('overrideChargedDays')}</Label>
                      <p className="text-sm text-muted-foreground">{t('overrideHelp')}</p>
                    </div>
                    <Switch
                      id="manual-day-count"
                      checked={manualOverride}
                      onCheckedChange={(checked) => {
                        setManualOverride(checked)
                        if (!checked) {
                          setValue('manualDayCountReason', '')
                        }
                      }}
                    />
                  </div>

                  {manualOverride && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="totalDays">{t('chargedDays')} *</Label>
                        <Input
                          id="totalDays"
                          type="number"
                          min={0}
                          step={1}
                          {...register('totalDays')}
                        />
                        {errors.totalDays && (
                          <p className="text-sm text-red-500 mt-1">{errors.totalDays.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="manualDayCountReason">{t('manualOverride')} *</Label>
                        <Input id="manualDayCountReason" {...register('manualDayCountReason')} />
                        {errors.manualDayCountReason && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.manualDayCountReason.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </EditRow>
            )}

            <EditRow title={t('reason')} description={t('editHelp.reason')}>
              <Textarea
                id="reason"
                rows={3}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                {...register('reason')}
              />
              <FieldError message={errors.reason?.message as string | undefined} />
            </EditRow>

            <EditRow title={t('additionalNotes')} description={t('editHelp.notes')}>
              <Textarea
                id="note"
                rows={2}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                {...register('note')}
              />
            </EditRow>

            <EditRow title={t('attachments')} description={t('editHelp.attachments')}>
              <MultiFileUpload
                name="attachments"
                label=""
                value={attachments}
                onChange={setAttachments}
                placeholder={t('uploadAttachments')}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                maxFiles={5}
                disabled={isReadOnly}
              />
            </EditRow>
          </EditSection>

          <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
            <div className="mx-auto flex max-w-6xl justify-end gap-3">
              <Link href={returnHref}>
                <Button type="button" variant="outline" className="cursor-pointer">
                  <X className="h-4 w-4 mr-2" />
                  {commonT('cancel')}
                </Button>
              </Link>
              {!isReadOnly && (
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
                    ? commonT('saving')
                    : mode === 'create'
                      ? t('createRequest')
                      : t('updateRequest')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
