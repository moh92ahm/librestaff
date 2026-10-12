import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
const CRON_SECRET = process.env.CRON_SECRET
const APP_URL = process.env.SCHEDULER_APP_URL || 'http://app:3000'
const POLL_SECONDS = Number(process.env.SCHEDULER_POLL_SECONDS || 60)

const JOB_PATHS = {
  'birthday-notifications': '/api/jobs/birthday-notifications',
  'expense-payments': '/api/jobs/expense-payments',
  'payroll-generation': '/api/jobs/payroll-generation',
  'notification-events': '/api/jobs/notification-events?limit=50',
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required for cron scheduler.')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { prepare: false })

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeTime(value, fallback) {
  const time = String(value || fallback)
  if (!/^\d{2}:\d{2}$/.test(time)) return fallback
  return time
}

function getLocalParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type) => parts.find((part) => part.type === type)?.value || ''
  const hour = value('hour') === '24' ? '00' : value('hour')
  return {
    day: Number(value('day')),
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    monthKey: `${value('year')}-${value('month')}`,
    time: `${hour}:${value('minute')}`,
  }
}

function getDueRunKey(job, now) {
  if (!job.enabled) return null

  const parts = getLocalParts(now, job.timezone)

  if (job.scheduleType === 'daily') {
    const dailyTime = normalizeTime(job.dailyTime, '08:00')
    const runKey = `${job.id}:${parts.dateKey}`
    return parts.time >= dailyTime && job.lastRunKey !== runKey ? runKey : null
  }

  if (job.scheduleType === 'monthly') {
    const day = Number(job.monthlyDay || 1)
    const monthlyTime = normalizeTime(job.monthlyTime, '08:00')
    const runKey = `${job.id}:${parts.monthKey}`
    return parts.day >= day && parts.time >= monthlyTime && job.lastRunKey !== runKey ? runKey : null
  }

  if (job.scheduleType === 'interval') {
    const intervalMinutes = Number(job.intervalMinutes || 5)
    const lastRunAt = job.lastRunAt ? new Date(job.lastRunAt).getTime() : 0
    if (!lastRunAt || now.getTime() - lastRunAt >= intervalMinutes * 60_000) {
      return `${job.id}:interval:${now.toISOString().slice(0, 16)}`
    }
  }

  return null
}

async function getJobs() {
  return sql`
    SELECT
      id,
      enabled,
      schedule_type AS "scheduleType",
      daily_time AS "dailyTime",
      monthly_day AS "monthlyDay",
      monthly_time AS "monthlyTime",
      interval_minutes AS "intervalMinutes",
      timezone,
      auto_run_outbox AS "autoRunOutbox",
      last_run_at AS "lastRunAt",
      last_run_key AS "lastRunKey"
    FROM cron_jobs
    WHERE enabled = true
  `
}

async function recordResult(jobId, runKey, status, result, error) {
  const now = new Date().toISOString()
  const resultJson = result ? JSON.stringify(result) : null
  await sql`
    UPDATE cron_jobs
    SET
      last_run_at = ${now},
      last_run_key = ${runKey},
      last_status = ${status},
      last_result = ${resultJson}::jsonb,
      last_error = ${error},
      updated_at = ${now}
    WHERE id = ${jobId}
  `
}

async function callJob(jobId) {
  const path = JOB_PATHS[jobId]
  if (!path) throw new Error(`Unknown cron job: ${jobId}`)
  if (!CRON_SECRET) throw new Error('CRON_SECRET is missing.')

  const response = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
    },
  })
  const text = await response.text()
  let body

  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { response: text }
  }

  if (!response.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`)
  }

  return body
}

async function runJob(job) {
  const result = await callJob(job.id)

  if ((job.id === 'birthday-notifications' || job.id === 'expense-payments') && job.autoRunOutbox) {
    return {
      ...result,
      notificationOutbox: await callJob('notification-events'),
    }
  }

  return result
}

async function tick() {
  const now = new Date()
  const jobs = await getJobs()

  for (const job of jobs) {
    const runKey = getDueRunKey(job, now)
    if (!runKey) continue

    try {
      console.log(`[cron-scheduler] running ${job.id} (${runKey})`)
      const result = await runJob(job)
      await recordResult(job.id, runKey, 'success', result, null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cron job failed.'
      console.error(`[cron-scheduler] ${job.id} failed: ${message}`)
      await recordResult(job.id, runKey, 'error', null, message)
    }
  }
}

async function main() {
  console.log(`[cron-scheduler] polling every ${POLL_SECONDS}s, app=${APP_URL}`)
  while (true) {
    await tick().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[cron-scheduler] tick failed: ${message}`)
    })

    if (process.env.SCHEDULER_ONCE === 'true') break
    await sleep(Math.max(POLL_SECONDS, 5) * 1000)
  }

  await sql.end()
}

process.on('SIGTERM', async () => {
  await sql.end().catch(() => undefined)
  process.exit(0)
})

await main()
