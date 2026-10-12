import { boolean, integer, jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const cronJobsTable = pgTable('cron_jobs', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  scheduleType: varchar('schedule_type', { length: 20 }).notNull(),
  dailyTime: varchar('daily_time', { length: 5 }),
  monthlyDay: integer('monthly_day'),
  monthlyTime: varchar('monthly_time', { length: 5 }),
  intervalMinutes: integer('interval_minutes'),
  timezone: varchar('timezone', { length: 100 }).notNull(),
  autoRunOutbox: boolean('auto_run_outbox').default(false).notNull(),
  lastRunAt: text('last_run_at'),
  lastRunKey: text('last_run_key'),
  lastStatus: varchar('last_status', { length: 20 }),
  lastResult: jsonb('last_result').$type<Record<string, unknown> | null>(),
  lastError: text('last_error'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
