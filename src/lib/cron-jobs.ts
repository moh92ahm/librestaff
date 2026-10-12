import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { cronJobsTable } from '@/db/schema'
import { emitCalendarWorkflowEvents } from '@/lib/birthday-notifications'
import { generateDueExpensePayments } from '@/lib/expense-generation'
import { generatePayrollsForPeriod, toPayrollMonth } from '@/lib/payroll-generation'
import { processNotificationEventOutbox } from '@/lib/notification-events'
import {
  CRON_JOB_IDS,
  DEFAULT_CRON_JOBS,
  type CronJobId,
  type CronRunStatus,
  isCronJobId,
  normalizeIntervalMinutes,
  normalizeMonthlyDay,
  normalizeTime,
  normalizeTimezone,
} from '@/lib/cron-schedule'

export type CronJobRow = typeof cronJobsTable.$inferSelect

export type CronActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export type RunCronJobInput = {
  date?: string | null
  month?: string | null
  year?: string | number | null
  limit?: string | number | null
  runKey?: string | null
}

export async function getOrCreateCronJobs() {
  const now = new Date().toISOString()

  for (const id of CRON_JOB_IDS) {
    const defaults = DEFAULT_CRON_JOBS[id]
    const legacyCalendarJob = id === 'calendar-workflow-events'
      ? await db.select().from(cronJobsTable).where(eq(cronJobsTable.id, 'birthday-notifications')).limit(1)
      : []
    const legacyValues = legacyCalendarJob[0]

    await db
      .insert(cronJobsTable)
      .values({
        id,
        enabled: legacyValues?.enabled ?? false,
        scheduleType: legacyValues?.scheduleType ?? defaults.scheduleType,
        dailyTime: legacyValues?.dailyTime ?? defaults.dailyTime,
        monthlyDay: legacyValues?.monthlyDay ?? defaults.monthlyDay,
        monthlyTime: legacyValues?.monthlyTime ?? defaults.monthlyTime,
        intervalMinutes: legacyValues?.intervalMinutes ?? defaults.intervalMinutes,
        timezone: legacyValues?.timezone ?? defaults.timezone,
        autoRunOutbox: legacyValues?.autoRunOutbox ?? defaults.autoRunOutbox,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
  }

  return db.select().from(cronJobsTable)
}

export function getCronSecretStatus() {
  return Boolean(process.env.CRON_SECRET)
}

export function getCronJobTitle(id: CronJobId) {
  return DEFAULT_CRON_JOBS[id].title
}

export function normalizeCronJobSettings(id: CronJobId, formData: FormData) {
  const defaults = DEFAULT_CRON_JOBS[id]
  const enabled = formData.get(`${id}:enabled`) === 'on'
  const timezone = normalizeTimezone(formData.get(`${id}:timezone`) || defaults.timezone)

  if (defaults.scheduleType === 'daily') {
    return {
      enabled,
      scheduleType: 'daily' as const,
      dailyTime: normalizeTime(formData.get(`${id}:dailyTime`), defaults.dailyTime || '08:00'),
      monthlyDay: null,
      monthlyTime: null,
      intervalMinutes: null,
      timezone,
      autoRunOutbox: formData.get(`${id}:autoRunOutbox`) === 'on',
    }
  }

  if (defaults.scheduleType === 'monthly') {
    return {
      enabled,
      scheduleType: 'monthly' as const,
      dailyTime: null,
      monthlyDay: normalizeMonthlyDay(formData.get(`${id}:monthlyDay`)),
      monthlyTime: normalizeTime(formData.get(`${id}:monthlyTime`), defaults.monthlyTime || '08:00'),
      intervalMinutes: null,
      timezone,
      autoRunOutbox: false,
    }
  }

  return {
    enabled,
    scheduleType: 'interval' as const,
    dailyTime: null,
    monthlyDay: null,
    monthlyTime: null,
    intervalMinutes: normalizeIntervalMinutes(formData.get(`${id}:intervalMinutes`)),
    timezone,
    autoRunOutbox: false,
  }
}

export async function saveCronJobsFromForm(formData: FormData) {
  const now = new Date().toISOString()

  for (const id of CRON_JOB_IDS) {
    const values = normalizeCronJobSettings(id, formData)
    await db
      .update(cronJobsTable)
      .set({
        ...values,
        updatedAt: now,
      })
      .where(eq(cronJobsTable.id, id))
  }
}

async function recordCronJobResult(
  id: CronJobId,
  status: CronRunStatus,
  result: Record<string, unknown> | null,
  error: string | null,
  runKey?: string | null,
) {
  const now = new Date().toISOString()
  await db
    .update(cronJobsTable)
    .set({
      lastRunAt: now,
      lastRunKey: runKey || null,
      lastStatus: status,
      lastResult: result,
      lastError: error,
      updatedAt: now,
    })
    .where(eq(cronJobsTable.id, id))
}

function parseDateInput(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export async function runCronJobNow(id: CronJobId, input: RunCronJobInput = {}) {
  if (!isCronJobId(id)) {
    throw new Error('Unknown cron job.')
  }

  const [job] = await db.select().from(cronJobsTable).where(eq(cronJobsTable.id, id)).limit(1)
  const runKey = input.runKey || `manual:${id}:${new Date().toISOString()}`

  try {
    let result: Record<string, unknown>

    if (id === 'calendar-workflow-events') {
      result = await emitCalendarWorkflowEvents(parseDateInput(input.date))
    } else if (id === 'expense-payments') {
      const payments = await generateDueExpensePayments(parseDateInput(input.date))
      result = { generated: payments.length }
    } else if (id === 'payroll-generation') {
      const date = parseDateInput(input.date)
      const month = toPayrollMonth(input.month || date.getMonth() + 1)
      const year = Number(input.year || date.getFullYear())
      if (!Number.isFinite(year)) throw new Error('Invalid payroll year.')
      result = await generatePayrollsForPeriod({ month, year })
    } else {
      const limit = Number(input.limit || 50)
      result = await processNotificationEventOutbox(Number.isFinite(limit) ? limit : 50)
    }

    if ((id === 'calendar-workflow-events' || id === 'expense-payments') && job?.autoRunOutbox) {
      result = {
        ...result,
        notificationOutbox: await processNotificationEventOutbox(50),
      }
    }

    await recordCronJobResult(id, 'success', result, null, runKey)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cron job failed.'
    await recordCronJobResult(id, 'error', null, message, runKey).catch(() => undefined)
    throw new Error(message)
  }
}
