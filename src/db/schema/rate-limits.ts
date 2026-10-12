import { integer, pgTable, text } from 'drizzle-orm/pg-core'

export const rateLimitsTable = pgTable('rate_limits', {
  keyHash: text('key_hash').primaryKey(),
  scope: text('scope').notNull(),
  count: integer('count').default(0).notNull(),
  windowStart: text('window_start').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
