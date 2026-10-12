import { pgTable, text, varchar, integer } from 'drizzle-orm/pg-core'

// ============================================
// Media Table
// ============================================

export const mediaTable = pgTable('media', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // File Information
  filename: varchar('filename', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  filesize: integer('filesize').notNull(), // Size in bytes
  width: integer('width'), // For images
  height: integer('height'), // For images
  storageKey: text('storage_key'),
  visibility: varchar('visibility', { length: 20 }).default('public').notNull(),

  // Metadata
  alt: text('alt'), // Alt text for images
  url: text('url').notNull(), // Full URL or path to file

  // Timestamps
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})
