'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, CalendarClock, Play, Save } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CronActionState, CronJobRow } from '@/lib/cron-jobs'
import {
  CRON_JOB_IDS,
  DEFAULT_CRON_JOBS,
  type CronJobId,
} from '@/lib/cron-schedule'
import { notify } from '@/lib/notify'

const initialState: CronActionState = { status: 'idle', message: '' }
type CronSettingsTranslator = ReturnType<typeof useTranslations<'cronSettings'>>

type CronSettingsFormProps = {
  jobs: CronJobRow[]
  cronSecretConfigured: boolean
  saveAction: (
    previousState: CronActionState,
    formData: FormData,
  ) => Promise<CronActionState>
  runAction: (
    jobId: CronJobId,
    previousState: CronActionState,
    formData: FormData,
  ) => Promise<CronActionState>
}

const jobLabelKeys: Record<CronJobId, string> = {
  'calendar-workflow-events': 'jobs.calendarWorkflowEvents',
  'expense-payments': 'jobs.expensePayments',
  'payroll-generation': 'jobs.payrollGeneration',
  'notification-events': 'jobs.notificationEvents',
}

function translateJob(jobId: CronJobId, t: CronSettingsTranslator) {
  const key = jobLabelKeys[jobId]
  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
  }
}

function translateActionMessage(message: string, t: CronSettingsTranslator) {
  if (message === 'Cron job settings saved.') return t('actions.saved')
  if (message === 'Cron job settings could not be saved.') return t('actions.saveError')
  if (message === 'Unknown cron job.') return t('actions.unknownJob')
  if (message === 'Cron job failed.') return t('actions.runError')
  if (message === 'Use HH:MM time format.') return t('actions.useTimeFormat')
  if (message === 'Time must be between 00:00 and 23:59.') return t('actions.timeRange')
  if (message === 'Invalid timezone.') return t('actions.invalidTimezone')
  if (message === 'Monthly day must be between 1 and 28.') return t('actions.monthlyDayRange')
  if (message === 'Interval must be between 1 and 1440 minutes.') return t('actions.intervalRange')
  if (message === 'Invalid payroll year.') return t('actions.invalidPayrollYear')

  const completedMatch = message.match(/^(.+) completed: (.+)$/)
  if (completedMatch) {
    const [, rawJobId, result] = completedMatch
    const jobId = rawJobId as CronJobId
    const jobTitle = jobLabelKeys[jobId] ? translateJob(jobId, t).title : rawJobId
    return t('actions.completed', { job: jobTitle, result })
  }

  return message
}

function SubmitButton({
  children,
  icon,
  pendingText,
  variant,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  pendingText: string
  variant?: React.ComponentProps<typeof Button>['variant']
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {icon}
      {pending ? pendingText : children}
    </Button>
  )
}

function ActionMessage({ state, t }: { state: CronActionState; t: CronSettingsTranslator }) {
  if (!state.message) return null
  return (
    <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
      {translateActionMessage(state.message, t)}
    </p>
  )
}

function formatDateTime(value: string | null | undefined, locale: string, t: CronSettingsTranslator) {
  if (!value) return t('never')
  return new Date(value).toLocaleString(locale)
}

function ResultPreview({ job, t }: { job: CronJobRow; t: CronSettingsTranslator }) {
  if (job.lastError) {
    return <p className="text-sm text-destructive">{job.lastError}</p>
  }

  if (!job.lastResult) {
    return <p className="text-sm text-muted-foreground">{t('noResult')}</p>
  }

  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(job.lastResult, null, 2)}
    </pre>
  )
}

function ScheduleFields({ job, t }: { job: CronJobRow; t: CronSettingsTranslator }) {
  const defaults = DEFAULT_CRON_JOBS[job.id as CronJobId]

  return (
    <>
      <input type="hidden" name={`${job.id}:timezone`} value={job.timezone || defaults.timezone} />
      <div className="flex items-center gap-2">
        <input
          id={`${job.id}-enabled`}
          name={`${job.id}:enabled`}
          type="checkbox"
          defaultChecked={job.enabled}
          className="size-4"
        />
        <Label htmlFor={`${job.id}-enabled`}>{t('enabled')}</Label>
      </div>

      {job.scheduleType === 'daily' && (
        <div className="grid gap-2">
          <Label htmlFor={`${job.id}-daily-time`}>{t('dailyTime')}</Label>
          <Input
            id={`${job.id}-daily-time`}
            name={`${job.id}:dailyTime`}
            type="time"
            defaultValue={job.dailyTime || defaults.dailyTime || '08:00'}
            required
          />
        </div>
      )}

      {job.scheduleType === 'monthly' && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${job.id}-monthly-day`}>{t('dayOfMonth')}</Label>
            <Input
              id={`${job.id}-monthly-day`}
              name={`${job.id}:monthlyDay`}
              type="number"
              min={1}
              max={28}
              defaultValue={job.monthlyDay || defaults.monthlyDay || 1}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${job.id}-monthly-time`}>{t('monthlyTime')}</Label>
            <Input
              id={`${job.id}-monthly-time`}
              name={`${job.id}:monthlyTime`}
              type="time"
              defaultValue={job.monthlyTime || defaults.monthlyTime || '08:20'}
              required
            />
          </div>
        </div>
      )}

      {job.scheduleType === 'interval' && (
        <div className="grid gap-2">
          <Label htmlFor={`${job.id}-interval`}>{t('intervalMinutes')}</Label>
          <Input
            id={`${job.id}-interval`}
            name={`${job.id}:intervalMinutes`}
            type="number"
            min={1}
            max={1440}
            defaultValue={job.intervalMinutes || defaults.intervalMinutes || 5}
            required
          />
        </div>
      )}

      {(job.id === 'calendar-workflow-events' || job.id === 'expense-payments') && (
        <div className="flex items-center gap-2">
          <input
            id={`${job.id}-outbox`}
            name={`${job.id}:autoRunOutbox`}
            type="checkbox"
            defaultChecked={job.autoRunOutbox}
            className="size-4"
          />
          <Label htmlFor={`${job.id}-outbox`}>{t('runOutboxAfterward')}</Label>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('timezone', { timezone: job.timezone || defaults.timezone })}
      </p>
    </>
  )
}

function ManualRunForm({
  job,
  runAction,
  t,
  locale,
}: {
  job: CronJobRow
  runAction: CronSettingsFormProps['runAction']
  t: CronSettingsTranslator
  locale: string
}) {
  const action = React.useMemo(() => runAction.bind(null, job.id as CronJobId), [job.id, runAction])
  const [state, formAction] = useActionState(action, initialState)
  const labels = translateJob(job.id as CronJobId, t)

  React.useEffect(() => {
    if (!state.message || state.status === 'idle') return
    const message = translateActionMessage(state.message, t)
    if (state.status === 'success') notify.success(message)
    if (state.status === 'error') notify.error(message)
  }, [state, t])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{labels.title}</CardTitle>
            <CardDescription>{labels.description}</CardDescription>
          </div>
          <Badge variant={job.lastStatus === 'success' ? 'success' : job.lastStatus === 'error' ? 'destructive' : 'secondary'}>
            {job.lastStatus ? t(`status.${job.lastStatus}`) : t('status.notRun')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_auto]">
          {(job.id === 'calendar-workflow-events' || job.id === 'expense-payments') && (
            <div className="grid gap-2">
              <Label htmlFor={`${job.id}-test-date`}>{t('testDate')}</Label>
              <Input id={`${job.id}-test-date`} name="date" type="date" />
            </div>
          )}

          {job.id === 'payroll-generation' && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${job.id}-test-month`}>{t('month')}</Label>
                <Input id={`${job.id}-test-month`} name="month" type="number" min={1} max={12} placeholder="7" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${job.id}-test-year`}>{t('year')}</Label>
                <Input id={`${job.id}-test-year`} name="year" type="number" min={2000} max={2100} placeholder="2026" />
              </div>
            </div>
          )}

          {job.id === 'notification-events' && (
            <div className="grid gap-2">
              <Label htmlFor={`${job.id}-limit`}>{t('limit')}</Label>
              <Input id={`${job.id}-limit`} name="limit" type="number" min={1} max={500} defaultValue={50} />
            </div>
          )}

          <div className="flex items-end">
            <SubmitButton icon={<Play className="mr-2 size-4" />} pendingText={t('running')}>
              {t('runNow')}
            </SubmitButton>
          </div>
          <div className="md:col-span-2">
            <ActionMessage state={state} t={t} />
          </div>
        </form>

        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {t('lastRun', { value: formatDateTime(job.lastRunAt, locale, t) })}
          </p>
          <ResultPreview job={job} t={t} />
        </div>
      </CardContent>
    </Card>
  )
}

export function CronSettingsForm({ jobs, cronSecretConfigured, saveAction, runAction }: CronSettingsFormProps) {
  const t = useTranslations('cronSettings')
  const locale = useLocale()
  const [saveState, saveFormAction] = useActionState(saveAction, initialState)
  const sortedJobs = CRON_JOB_IDS.map((id) => jobs.find((job) => job.id === id)).filter(Boolean) as CronJobRow[]

  React.useEffect(() => {
    if (!saveState.message || saveState.status === 'idle') return
    const message = translateActionMessage(saveState.message, t)
    if (saveState.status === 'success') notify.success(message)
    if (saveState.status === 'error') notify.error(message)
  }, [saveState, t])

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t('runtimeStatus')}</CardTitle>
              <CardDescription>{t('runtimeDescription')}</CardDescription>
            </div>
            <Badge variant={cronSecretConfigured ? 'success' : 'destructive'}>
              {cronSecretConfigured ? t('cronSecretConfigured') : t('cronSecretMissing')}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <form action={saveFormAction} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedJobs.map((job) => {
            const labels = translateJob(job.id as CronJobId, t)
            return (
              <Card key={job.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="size-4" />
                    {labels.title}
                  </CardTitle>
                  <CardDescription>{labels.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.id === 'payroll-generation' && (
                    <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {t('payrollWarning')}
                    </div>
                  )}
                  <ScheduleFields job={job} t={t} />
                </CardContent>
              </Card>
            )
          })}
        </div>
        <div className="flex items-center justify-end gap-3">
          <ActionMessage state={saveState} t={t} />
          <SubmitButton icon={<Save className="mr-2 size-4" />} pendingText={t('saving')}>
            {t('saveSchedules')}
          </SubmitButton>
        </div>
      </form>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('manualTests')}</h2>
          <p className="text-sm text-muted-foreground">{t('manualTestsDescription')}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedJobs.map((job) => (
            <ManualRunForm key={job.id} job={job} runAction={runAction} t={t} locale={locale} />
          ))}
        </div>
      </div>
    </div>
  )
}
