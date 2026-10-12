import { index, integer, jsonb, pgTable, text, unique, varchar, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { usersTable } from './users'

export type WorkflowConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'dateIsToday'
  | 'dateWithinNextDays'

export type WorkflowCondition = {
  field: string
  operator: WorkflowConditionOperator
  value?: string
}

export type WorkflowRecipientSelector = {
  type:
    | 'triggeredEmployee'
    | 'actor'
    | 'employeeManager'
    | 'departmentManager'
    | 'mentionedUsers'
    | 'announcementChannelMembers'
    | 'eventRecipients'
    | 'specificUsers'
    | 'usersWithRole'
    | 'usersInDepartment'
    | 'admins'
    | 'applicantEmail'
  userIds?: string[]
  roleIds?: string[]
  departmentIds?: string[]
}

export type WorkflowAction = {
  type: 'sendNotification' | 'sendEmail' | 'postAnnouncement' | 'createActivityLog'
  title?: string
  message?: string
  body?: string
  categoryId?: string
  recipients?: WorkflowRecipientSelector[]
}

export type WorkflowTriggerConfig = Record<string, unknown>

export const workflowsTable = pgTable(
  'workflows',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    triggerType: varchar('trigger_type', { length: 120 }).notNull(),
    triggerConfig: jsonb('trigger_config').$type<WorkflowTriggerConfig>().default({}).notNull(),
    conditions: jsonb('conditions').$type<WorkflowCondition[]>().default([]).notNull(),
    actions: jsonb('actions').$type<WorkflowAction[]>().default([]).notNull(),
    createdById: text('created_by_id'),
    createdAt: text('created_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [
    index('workflows_trigger_enabled_idx').on(table.triggerType, table.enabled),
    index('workflows_updated_idx').on(table.updatedAt),
  ],
)

export const workflowRunsTable = pgTable(
  'workflow_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: text('workflow_id').notNull(),
    sourceEventId: text('source_event_id').notNull(),
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    sourceId: text('source_id').notNull(),
    status: varchar('status', { length: 32 }).default('running').notNull(),
    conditionResults: jsonb('condition_results').$type<Record<string, unknown>>().default({}).notNull(),
    error: text('error'),
    startedAt: text('started_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    finishedAt: text('finished_at'),
  },
  (table) => [
    unique('workflow_runs_workflow_source_unique').on(table.workflowId, table.sourceEventId),
    index('workflow_runs_workflow_idx').on(table.workflowId, table.startedAt),
    index('workflow_runs_source_idx').on(table.sourceType, table.sourceId),
  ],
)

export const workflowActionRunsTable = pgTable(
  'workflow_action_runs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowRunId: text('workflow_run_id').notNull(),
    actionIndex: integer('action_index').notNull(),
    actionType: varchar('action_type', { length: 80 }).notNull(),
    status: varchar('status', { length: 32 }).default('running').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
    output: jsonb('output').$type<Record<string, unknown>>().default({}).notNull(),
    error: text('error'),
    startedAt: text('started_at')
      .$defaultFn(() => new Date().toISOString())
      .notNull(),
    finishedAt: text('finished_at'),
  },
  (table) => [index('workflow_action_runs_run_idx').on(table.workflowRunId, table.actionIndex)],
)

export const workflowsRelations = relations(workflowsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [workflowsTable.createdById],
    references: [usersTable.id],
  }),
  runs: many(workflowRunsTable),
}))

export const workflowRunsRelations = relations(workflowRunsTable, ({ one, many }) => ({
  workflow: one(workflowsTable, {
    fields: [workflowRunsTable.workflowId],
    references: [workflowsTable.id],
  }),
  actionRuns: many(workflowActionRunsTable),
}))

export const workflowActionRunsRelations = relations(workflowActionRunsTable, ({ one }) => ({
  run: one(workflowRunsTable, {
    fields: [workflowActionRunsTable.workflowRunId],
    references: [workflowRunsTable.id],
  }),
}))
