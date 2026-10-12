'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { leaveEntitlementTiersTable, leavePolicySettingsTable } from '@/db/schema'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

type LeavePolicySettings = InferSelectModel<typeof leavePolicySettingsTable>
type LeaveEntitlementTier = InferSelectModel<typeof leaveEntitlementTiersTable>

type LeaveSettingsPanelProps = {
  settings: LeavePolicySettings
  tiers: LeaveEntitlementTier[]
  updatePolicyAction: (formData: FormData) => Promise<void>
  saveTierAction: (formData: FormData) => Promise<void>
  deleteTierAction: (formData: FormData) => Promise<void>
}

function PolicySwitch({
  name,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  name: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
      <div>
        <Label htmlFor={name}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={name} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function PolicySelect({
  name,
  label,
  description,
  value,
  onValueChange,
  options,
}: {
  name: string
  label: string
  description: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <input type="hidden" name={name} value={value} />
      <div>
        <Label htmlFor={name}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function countDaysInRange(
  start: Date,
  end: Date,
  options: { countSaturday: boolean; countSunday: boolean; countEveryDay?: boolean },
) {
  let count = 0
  const current = new Date(start)

  while (current <= end) {
    const day = current.getDay()
    const isSaturday = day === 6
    const isSunday = day === 0
    if (
      options.countEveryDay ||
      ((!isSaturday || options.countSaturday) && (!isSunday || options.countSunday))
    ) {
      count += 1
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

function formatExampleAmount(value: number) {
  return value.toFixed(2).replace(/\.00$/, '')
}

function TierDialog({
  tier,
  action,
  children,
}: {
  tier?: LeaveEntitlementTier
  action: (formData: FormData) => Promise<void>
  children: React.ReactNode
}) {
  const t = useTranslations('leaves')
  const commonT = useTranslations('common')
  const formAction = async (formData: FormData) => {
    try {
      await action(formData)
      notify.success(tier ? t('tierUpdated') : t('tierCreated'))
    } catch (error) {
      notify.error(error, t('tierSaveFailed'))
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tier ? t('editTier') : t('newTier')}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {tier && <input type="hidden" name="id" value={tier.id} />}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor={`minimumServiceMonths-${tier?.id || 'new'}`}>
                {t('minimumServiceMonths')}
              </Label>
              <Input
                id={`minimumServiceMonths-${tier?.id || 'new'}`}
                name="minimumServiceMonths"
                type="number"
                min={0}
                step={1}
                defaultValue={tier?.minimumServiceMonths ?? 12}
                required
              />
            </div>
            <div>
              <Label htmlFor={`days-${tier?.id || 'new'}`}>{t('annualDays')}</Label>
              <Input
                id={`days-${tier?.id || 'new'}`}
                name="days"
                type="number"
                min={0}
                step={1}
                defaultValue={tier?.days ?? 14}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`label-${tier?.id || 'new'}`}>{t('label')}</Label>
            <Input
              id={`label-${tier?.id || 'new'}`}
              name="label"
              defaultValue={tier?.label || ''}
              placeholder={t('tierLabelPlaceholder')}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={tier?.isActive ?? true}
            />
            {commonT('active')}
          </label>
          <DialogFooter>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              {commonT('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LeaveSettingsPanel({
  settings,
  tiers,
  updatePolicyAction,
  saveTierAction,
  deleteTierAction,
}: LeaveSettingsPanelProps) {
  const t = useTranslations('leaves')
  const commonT = useTranslations('common')
  const initialDailyRateBasis =
    settings.unpaidLeaveDeductionDailyRateBasis === 'fixed30' ||
    settings.unpaidLeaveDeductionDailyRateBasis === 'calendarDays'
      ? settings.unpaidLeaveDeductionDailyRateBasis
      : 'workingDays'
  const initialDayBasis =
    settings.unpaidLeaveDeductionDayBasis === 'calendarDays' ? 'calendarDays' : 'leavePolicy'
  const [countSaturday, setCountSaturday] = React.useState(settings.countSaturday)
  const [countSunday, setCountSunday] = React.useState(settings.countSunday)
  const [countHolidays, setCountHolidays] = React.useState(settings.countHolidays)
  const [allowNegativeBalance, setAllowNegativeBalance] = React.useState(
    settings.allowNegativeBalance,
  )
  const [unpaidLeaveDeductionEnabled, setUnpaidLeaveDeductionEnabled] = React.useState(
    settings.unpaidLeaveDeductionEnabled,
  )
  const [dailyRateBasis, setDailyRateBasis] = React.useState(initialDailyRateBasis)
  const [dayBasis, setDayBasis] = React.useState(initialDayBasis)
  const unpaidDeductionExample = React.useMemo(() => {
    const grossSalary = 6500
    const monthStart = new Date(2026, 5, 1)
    const monthEnd = new Date(2026, 5, 30)
    const leaveStart = new Date(2026, 5, 11)
    const leaveEnd = new Date(2026, 5, 15)
    const workingDayDivisor = countDaysInRange(monthStart, monthEnd, {
      countSaturday,
      countSunday,
    })
    const divisor =
      dailyRateBasis === 'fixed30'
        ? 30
        : dailyRateBasis === 'calendarDays'
          ? 30
          : workingDayDivisor
    const unpaidDays =
      dayBasis === 'calendarDays'
        ? countDaysInRange(leaveStart, leaveEnd, {
            countSaturday,
            countSunday,
            countEveryDay: true,
          })
        : countDaysInRange(leaveStart, leaveEnd, { countSaturday, countSunday })
    const dailyRate = divisor > 0 ? Math.round((grossSalary / divisor) * 100) / 100 : 0
    const deduction = Math.round(unpaidDays * dailyRate * 100) / 100
    const divisorLabel =
      dailyRateBasis === 'fixed30'
        ? t('dailyRateFixed30')
        : dailyRateBasis === 'calendarDays'
          ? t('dailyRateCalendarDays')
          : t('dailyRateWorkingDays')
    const dayBasisLabel =
      dayBasis === 'calendarDays' ? t('dayBasisCalendarDays') : t('dayBasisLeavePolicy')

    return {
      grossSalary,
      divisor,
      divisorLabel,
      unpaidDays,
      dayBasisLabel,
      dailyRate,
      deduction,
    }
  }, [countSaturday, countSunday, dailyRateBasis, dayBasis, t])
  const columns = [
    {
      key: 'label' as keyof LeaveEntitlementTier,
      header: t('label'),
    },
    {
      key: 'minimumServiceMonths' as keyof LeaveEntitlementTier,
      header: t('minimumService'),
      render: (value: unknown) => t('months', { count: Number(value) || 0 }),
    },
    {
      key: 'days' as keyof LeaveEntitlementTier,
      header: t('annualDays'),
    },
    {
      key: 'isActive' as keyof LeaveEntitlementTier,
      header: commonT('status'),
      render: (value: unknown) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? commonT('active') : commonT('inactive')}
        </Badge>
      ),
    },
  ]

  const actionColumn = (tier: LeaveEntitlementTier) => (
    <div className="flex gap-2">
      <TierDialog tier={tier} action={saveTierAction}>
        <Button variant="outline" className="flex-1">
          {commonT('edit')}
        </Button>
      </TierDialog>
      <form
        action={async (formData) => {
          try {
            await deleteTierAction(formData)
            notify.success(t('tierDeleted'))
          } catch (error) {
            notify.error(error, t('tierDeleteFailed'))
          }
        }}
      >
        <input type="hidden" name="id" value={tier.id} />
        <Button variant="ghost" size="icon" title={t('deleteTier')}>
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">{t('deleteTier')}</span>
        </Button>
      </form>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('policy')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              try {
                await updatePolicyAction(formData)
                notify.success(t('policySaved'))
              } catch (error) {
                notify.error(error, t('policySaveFailed'))
              }
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={settings.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="carryoverLimitDays">{t('carryoverLimit')}</Label>
                <Input
                  id="carryoverLimitDays"
                  name="carryoverLimitDays"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={settings.carryoverLimitDays ?? ''}
                  placeholder={t('unlimited')}
                />
                <p className="mt-1 text-sm text-muted-foreground">{t('carryoverHelp')}</p>
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">{t('leavePolicy')}</h2>
              <p className="text-sm text-muted-foreground">{t('leavePolicyDescription')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PolicySwitch
                name="countSaturday"
                label={t('countSaturday')}
                description={t('countSaturdayDescription')}
                checked={countSaturday}
                onCheckedChange={setCountSaturday}
              />
              <PolicySwitch
                name="countSunday"
                label={t('countSunday')}
                description={t('countSundayDescription')}
                checked={countSunday}
                onCheckedChange={setCountSunday}
              />
              <PolicySwitch
                name="countHolidays"
                label={t('countPublicHolidays')}
                description={t('countPublicHolidaysDescription')}
                checked={countHolidays}
                onCheckedChange={setCountHolidays}
              />
              <PolicySwitch
                name="allowNegativeBalance"
                label={t('allowNegativeBalance')}
                description={t('allowNegativeBalanceDescription')}
                checked={allowNegativeBalance}
                onCheckedChange={setAllowNegativeBalance}
              />
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h2 className="text-base font-semibold">{t('unpaidLeaveDeduction')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('unpaidLeaveDeductionDescription')}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <PolicySwitch
                  name="unpaidLeaveDeductionEnabled"
                  label={t('unpaidLeaveDeductionEnabled')}
                  description={t('unpaidLeaveDeductionEnabledDescription')}
                  checked={unpaidLeaveDeductionEnabled}
                  onCheckedChange={setUnpaidLeaveDeductionEnabled}
                />
                <PolicySelect
                  name="unpaidLeaveDeductionDailyRateBasis"
                  label={t('unpaidLeaveDailyRateBasis')}
                  description={t('unpaidLeaveDailyRateBasisDescription')}
                  value={dailyRateBasis}
                  onValueChange={setDailyRateBasis}
                  options={[
                    { value: 'workingDays', label: t('dailyRateWorkingDays') },
                    { value: 'fixed30', label: t('dailyRateFixed30') },
                    { value: 'calendarDays', label: t('dailyRateCalendarDays') },
                  ]}
                />
                <PolicySelect
                  name="unpaidLeaveDeductionDayBasis"
                  label={t('unpaidLeaveDayBasis')}
                  description={t('unpaidLeaveDayBasisDescription')}
                  value={dayBasis}
                  onValueChange={setDayBasis}
                  options={[
                    { value: 'leavePolicy', label: t('dayBasisLeavePolicy') },
                    { value: 'calendarDays', label: t('dayBasisCalendarDays') },
                  ]}
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{t('unpaidLeaveExampleTitle')}</div>
                {unpaidLeaveDeductionEnabled ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>{t('unpaidLeaveExampleScenario')}</p>
                    <p>
                      {t('unpaidLeaveExampleDivisor', {
                        basis: unpaidDeductionExample.divisorLabel,
                        divisor: unpaidDeductionExample.divisor,
                      })}
                    </p>
                    <p>
                      {t('unpaidLeaveExampleDays', {
                        basis: unpaidDeductionExample.dayBasisLabel,
                        days: unpaidDeductionExample.unpaidDays,
                      })}
                    </p>
                    <p>
                      {t('unpaidLeaveExampleResult', {
                        gross: formatExampleAmount(unpaidDeductionExample.grossSalary),
                        divisor: unpaidDeductionExample.divisor,
                        dailyRate: formatExampleAmount(unpaidDeductionExample.dailyRate),
                        days: unpaidDeductionExample.unpaidDays,
                        deduction: formatExampleAmount(unpaidDeductionExample.deduction),
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    {t('unpaidLeaveExampleDisabled')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {t('savePolicy')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{t('entitlementTiers')}</CardTitle>
            <TierDialog action={saveTierAction}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('newTier')}
              </Button>
            </TierDialog>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<LeaveEntitlementTier>
            data={tiers}
            columns={columns}
            actionColumn={actionColumn}
          />
        </CardContent>
      </Card>
    </div>
  )
}
