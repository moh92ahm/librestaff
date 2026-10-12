import { boolean, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const emailSettingsTable = pgTable('email_settings', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').default(false).notNull(),
  fromName: varchar('from_name', { length: 255 }).notNull(),
  fromEmail: varchar('from_email', { length: 255 }).notNull(),
  replyToEmail: varchar('reply_to_email', { length: 255 }),
  smtpHost: varchar('smtp_host', { length: 255 }).notNull(),
  smtpPort: integer('smtp_port').default(587).notNull(),
  secureMode: varchar('secure_mode', { length: 20 }).default('starttls').notNull(),
  authMode: varchar('auth_mode', { length: 20 }).default('none').notNull(),
  encryptedSmtpUsername: text('encrypted_smtp_username'),
  encryptedSmtpPassword: text('encrypted_smtp_password'),
  lastTestAt: text('last_test_at'),
  lastTestStatus: varchar('last_test_status', { length: 20 }),
  lastTestError: text('last_test_error'),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
