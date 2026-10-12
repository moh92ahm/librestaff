import { pgTable, text, varchar, pgEnum, json } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

// ============================================
// Inventory Log Enum
// ============================================

export const inventoryLogEventEnum = pgEnum('inventory_log_event', [
  'created',
  'holderChanged',
  'statusChanged',
])

// ============================================
// Enums
// ============================================

export const itemTypeEnum = pgEnum('item_type', [
  'laptop',
  'phone',
  'accessory',
  'simCard',
  'other',
])

export const inventoryStatusEnum = pgEnum('inventory_status', [
  'inUse',
  'inStock',
  'needsRepair',
  'underRepair',
])

// ============================================
// Inventory Table
// ============================================

export const inventoryTable = pgTable('inventory', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Item Information
  itemType: itemTypeEnum('item_type').default('other').notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  serialNumber: varchar('serial_number', { length: 255 }).notNull().unique(),

  // Holder (User assigned to)
  holderId: text('holder_id'),

  // Status
  status: inventoryStatusEnum('status').default('inStock').notNull(),

  // Dates
  purchaseDate: text('purchase_date'), // ISO 8601: "YYYY-MM-DD"
  warrantyExpiry: text('warranty_expiry'), // ISO 8601: "YYYY-MM-DD"

  // Media & Notes
  images: json('images').$type<string[]>().default([]), // Array of media URLs
  notes: text('notes'),

  // Timestamps
  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

// ============================================
// Inventory Logs Table
// ============================================

export const inventoryLogsTable = pgTable('inventory_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  inventoryId: text('inventory_id').notNull(),

  eventType: inventoryLogEventEnum('event_type').notNull(),

  // For status changes: old/new status value; for holder changes: old/new user ID or null
  oldValue: text('old_value'),
  newValue: text('new_value'),

  // Human-readable label for display (e.g. holder name, status label)
  oldLabel: text('old_label'),
  newLabel: text('new_label'),

  actorUserId: text('actor_user_id'),

  createdAt: text('created_at')
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
})

export const inventoryLogsRelations = relations(inventoryLogsTable, ({ one }) => ({
  inventory: one(inventoryTable, {
    fields: [inventoryLogsTable.inventoryId],
    references: [inventoryTable.id],
  }),
  actor: one(usersTable, {
    fields: [inventoryLogsTable.actorUserId],
    references: [usersTable.id],
  }),
}))

// ============================================
// Relations
// ============================================

export const inventoryRelations = relations(inventoryTable, ({ one, many }) => ({
  holder: one(usersTable, {
    fields: [inventoryTable.holderId],
    references: [usersTable.id],
  }),
  logs: many(inventoryLogsTable),
}))
