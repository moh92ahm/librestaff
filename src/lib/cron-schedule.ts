export const CRON_JOB_IDS = [
  'calendar-workflow-events',
  'expense-payments',
  'payroll-generation',
  'notification-events',
] as const

export type CronJobId = (typeof CRON_JOB_IDS)[number]
export type CronScheduleType = 'daily' | 'monthly' | 'interval'
export type CronRunStatus = 'success' | 'error'

export type CronScheduleConfig = {
  id: CronJobId
  enabled: boolean
  scheduleType: CronScheduleType
  dailyTime?: string | null
  monthlyDay?: number | null
  monthlyTime?: string | null
  intervalMinutes?: number | null
  timezone: string
  lastRunAt?: string | null
  lastRunKey?: string | null
}

export const DEFAULT_CRON_TIMEZONE = 'Europe/Istanbul'

export const DEFAULT_CRON_JOBS: Record<
  CronJobId,
  {
    title: string
    description: string
    scheduleType: CronScheduleType
    dailyTime: string | null
    monthlyDay: number | null
    monthlyTime: string | null
    intervalMinutes: number | null
    timezone: string
    autoRunOutbox: boolean
  }
> = {
  'calendar-workflow-events': {
    title: 'Calendar workflow events',
    description: 'Creates upcoming calendar workflow events for birthdays, work anniversaries, and future calendar items.',
    scheduleType: 'daily',
    dailyTime: '08:00',
    monthlyDay: null,
    monthlyTime: null,
    intervalMinutes: null,
    timezone: DEFAULT_CRON_TIMEZONE,
    autoRunOutbox: true,
  },
  'expense-payments': {
    title: 'Expense payments',
    description: 'Generates due recurring expense payments and payment notifications.',
    scheduleType: 'daily',
    dailyTime: '08:10',
    monthlyDay: null,
    monthlyTime: null,
    intervalMinutes: null,
    timezone: DEFAULT_CRON_TIMEZONE,
    autoRunOutbox: true,
  },
  'payroll-generation': {
    title: 'Payroll generation',
    description: 'Creates payroll records for active employees with due payroll settings.',
    scheduleType: 'monthly',
    dailyTime: null,
    monthlyDay: 1,
    monthlyTime: '08:20',
    intervalMinutes: null,
    timezone: DEFAULT_CRON_TIMEZONE,
    autoRunOutbox: false,
  },
  'notification-events': {
    title: 'Notification outbox',
    description: 'Processes pending notification events and email deliveries.',
    scheduleType: 'interval',
    dailyTime: null,
    monthlyDay: null,
    monthlyTime: null,
    intervalMinutes: 5,
    timezone: DEFAULT_CRON_TIMEZONE,
    autoRunOutbox: false,
  },
}

export function isCronJobId(value: string): value is CronJobId {
  return CRON_JOB_IDS.includes(value as CronJobId)
}

export function isCronScheduleType(value: string): value is CronScheduleType {
  return value === 'daily' || value === 'monthly' || value === 'interval'
}

export function assertValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error('Use HH:MM time format.')
  }

  const [hour, minute] = value.split(':').map(Number)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Time must be between 00:00 and 23:59.')
  }
}

export function normalizeTime(value: unknown, fallback: string) {
  const time = String(value || fallback).trim()
  assertValidTime(time)
  return time
}

export function normalizeTimezone(value: unknown) {
  const timezone = String(value || DEFAULT_CRON_TIMEZONE).trim() || DEFAULT_CRON_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error('Invalid timezone.')
  }
  return timezone
}

export function normalizeMonthlyDay(value: unknown) {
  const day = Number(value || 1)
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    throw new Error('Monthly day must be between 1 and 28.')
  }
  return day
}

export function normalizeIntervalMinutes(value: unknown) {
  const minutes = Number(value || 5)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('Interval must be between 1 and 1440 minutes.')
  }
  return minutes
}

export function getLocalDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
  const hour = value('hour') === '24' ? '00' : value('hour')

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour,
    minute: value('minute'),
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    monthKey: `${value('year')}-${value('month')}`,
    time: `${hour}:${value('minute')}`,
  }
}

export function getCronDueRunKey(config: CronScheduleConfig, now = new Date()) {
  if (!config.enabled) return null

  const timezone = normalizeTimezone(config.timezone)
  const parts = getLocalDateTimeParts(now, timezone)

  if (config.scheduleType === 'daily') {
    const dailyTime = normalizeTime(config.dailyTime, DEFAULT_CRON_JOBS[config.id].dailyTime || '08:00')
    const runKey = `${config.id}:${parts.dateKey}`
    return parts.time >= dailyTime && config.lastRunKey !== runKey ? runKey : null
  }

  if (config.scheduleType === 'monthly') {
    const monthlyDay = normalizeMonthlyDay(config.monthlyDay)
    const monthlyTime = normalizeTime(config.monthlyTime, DEFAULT_CRON_JOBS[config.id].monthlyTime || '08:00')
    const runKey = `${config.id}:${parts.monthKey}`
    return Number(parts.day) >= monthlyDay && parts.time >= monthlyTime && config.lastRunKey !== runKey
      ? runKey
      : null
  }

  const intervalMinutes = normalizeIntervalMinutes(config.intervalMinutes)
  const lastRunTime = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0
  if (!lastRunTime || now.getTime() - lastRunTime >= intervalMinutes * 60_000) {
    return `${config.id}:interval:${now.toISOString().slice(0, 16)}`
  }

  return null
}
