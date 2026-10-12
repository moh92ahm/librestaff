import { json, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const companySettingsTable = pgTable('company_settings', {
  id: text('id').primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  logoUrl: text('logo_url').notNull(),
  website: text('website'),
  companyEmail: varchar('company_email', { length: 255 }),
  phone: varchar('phone', { length: 100 }),
  country: varchar('country', { length: 100 }),
  address: text('address'),
  taxRegistrationNumber: varchar('tax_registration_number', { length: 255 }),
  defaultTimezone: varchar('default_timezone', { length: 100 }).notNull(),
  workingWeek: json('working_week').$type<string[]>().notNull(),
  holidayCountries: json('holiday_countries').$type<string[]>().notNull(),
  enabledLanguages: json('enabled_languages').$type<string[]>().notNull(),
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
