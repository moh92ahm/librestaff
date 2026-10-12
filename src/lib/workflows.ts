import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  departmentsTable,
  rolesTable,
  usersTable,
  workflowActionRunsTable,
  workflowRunsTable,
  workflowsTable,
  type NotificationOutboxPayload,
  type NotificationOutboxRecipient,
  type WorkflowAction,
  type WorkflowCondition,
  type WorkflowRecipientSelector,
} from '@/db/schema'
import { createRenderedNotifications } from '@/lib/notifications'
import { sendEmail } from '@/lib/email-sender'
import { getDepartmentIdsWithAncestors, getDepartmentRowsByIds } from '@/lib/department-hierarchy'
import { writeMemberActivityLog } from '@/lib/member-activity'
import {
  WORKFLOW_TRIGGER_DEFINITIONS,
  WORKFLOW_TRIGGER_TYPES,
  getWorkflowActionLabel,
  getWorkflowTriggerDefinition,
  normalizeWorkflowActions,
  normalizeWorkflowConditions,
  normalizeWorkflowTriggerType,
} from '@/lib/workflow-definitions'

export type WorkflowEvent = {
  id: string
  eventType: string
  sourceType: string
  sourceId: string
  actorUserId?: string | null
  recipients: NotificationOutboxRecipient[]
  payload: NotificationOutboxPayload
}

type Recipient = {
  id: string
  email?: string | null
  fullName?: string | null
}

type ExternalEmailRecipient = {
  email: string
  fullName?: string | null
}

export type WorkflowPreviewResult = {
  status: 'wouldRun' | 'skipped' | 'failed'
  triggerType: string
  sourceType: string
  sourceId: string
  conditionResults: ReturnType<typeof evaluateConditions>
  actions: WorkflowPreviewAction[]
  error?: string
}

export type WorkflowPreviewAction = {
  index: number
  type: WorkflowAction['type']
  label: string
  status: 'wouldRun' | 'skipped' | 'failed'
  title: string
  message: string
  body: string
  recipients: Array<{ id: string; fullName: string; email: string }>
  externalEmails: Array<{ email: string; fullName: string }>
  error?: string
}

const DEFAULT_WORKFLOW_NAMES = new Set(defaultWorkflowTemplates().map((workflow) => workflow.name))

export async function ensureDefaultWorkflows() {
  await deleteAnnouncementWorkflows()
  await deleteDefaultWorkflows()
}

function isAnnouncementWorkflow(workflow: typeof workflowsTable.$inferSelect) {
  if (workflow.triggerType.startsWith('announcement.')) return true

  const actions = Array.isArray(workflow.actions) ? workflow.actions : []
  return actions.some((action) => {
    const item = action as Partial<WorkflowAction>
    if (item.type === 'postAnnouncement') return true
    const recipients = Array.isArray(item.recipients) ? item.recipients : []
    return recipients.some((recipient) => {
      const selector = recipient as Partial<WorkflowRecipientSelector>
      return selector.type === 'announcementChannelMembers'
    })
  })
}

async function deleteAnnouncementWorkflows() {
  const workflows = await db.select().from(workflowsTable)
  const workflowIds = workflows.filter(isAnnouncementWorkflow).map((workflow) => workflow.id)
  await deleteWorkflowsByIds(workflowIds)
}

async function deleteDefaultWorkflows() {
  const defaults = await db
    .select({ id: workflowsTable.id })
    .from(workflowsTable)
    .where(inArray(workflowsTable.name, Array.from(DEFAULT_WORKFLOW_NAMES)))

  await deleteWorkflowsByIds(defaults.map((workflow) => workflow.id))
}

async function deleteWorkflowsByIds(workflowIds: string[]) {
  if (workflowIds.length === 0) return
  const runs = await db
    .select({ id: workflowRunsTable.id })
    .from(workflowRunsTable)
    .where(
      workflowIds.length === 1
        ? eq(workflowRunsTable.workflowId, workflowIds[0])
        : inArray(workflowRunsTable.workflowId, workflowIds),
    )

  const runIds = runs.map((run) => run.id)

  await db.transaction(async (tx) => {
    if (runIds.length > 0) {
      await tx
        .delete(workflowActionRunsTable)
        .where(
          runIds.length === 1
            ? eq(workflowActionRunsTable.workflowRunId, runIds[0])
            : inArray(workflowActionRunsTable.workflowRunId, runIds),
        )

      await tx
        .delete(workflowRunsTable)
        .where(
          workflowIds.length === 1
            ? eq(workflowRunsTable.workflowId, workflowIds[0])
            : inArray(workflowRunsTable.workflowId, workflowIds),
        )
    }

    await tx
      .delete(workflowsTable)
      .where(
        workflowIds.length === 1
          ? eq(workflowsTable.id, workflowIds[0])
          : inArray(workflowsTable.id, workflowIds),
      )
  })
}

export async function getWorkflowAdminData() {
  await ensureDefaultWorkflows()

  const [workflows, runs, users, roles, departments] = await Promise.all([
    db.select().from(workflowsTable).orderBy(desc(workflowsTable.updatedAt)),
    db
      .select()
      .from(workflowRunsTable)
      .orderBy(desc(workflowRunsTable.startedAt))
      .limit(80),
    db
      .select({ id: usersTable.id, label: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.fullName),
    db
      .select({ id: rolesTable.id, label: rolesTable.displayName })
      .from(rolesTable)
      .where(eq(rolesTable.isActive, true))
      .orderBy(rolesTable.displayName),
    db
      .select({ id: departmentsTable.id, label: departmentsTable.name })
      .from(departmentsTable)
      .orderBy(departmentsTable.name),
  ])

  return {
    workflows: workflows.map((workflow) => ({
      ...workflow,
      conditions: normalizeWorkflowConditions(workflow.conditions),
      actions: normalizeWorkflowActions(workflow.actions),
      triggerType: normalizeWorkflowTriggerType(workflow.triggerType),
      triggerLabel: getWorkflowTriggerDefinition(workflow.triggerType)?.label || workflow.triggerType,
      actionSummary: normalizeWorkflowActions(workflow.actions)
        .map((action) => getWorkflowActionLabel(action.type))
        .join(', '),
      lastRun: runs.find((run) => run.workflowId === workflow.id) || null,
    })),
    runs,
    options: {
      triggers: WORKFLOW_TRIGGER_DEFINITIONS,
      users,
      roles,
      departments,
      channels: [],
    },
  }
}

export async function processWorkflowEvent(event: WorkflowEvent) {
  await ensureDefaultWorkflows()
  const eventType = normalizeWorkflowTriggerType(event.eventType)
  const matchingTriggerTypes = getMatchingWorkflowTriggerTypes(eventType)

  const workflows = await db
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.enabled, true), inArray(workflowsTable.triggerType, matchingTriggerTypes)))
    .orderBy(asc(workflowsTable.createdAt))

  for (const workflow of workflows) {
    await processWorkflow(workflow, { ...event, eventType }).catch(() => undefined)
  }
}

function getMatchingWorkflowTriggerTypes(eventType: string) {
  if (eventType === WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming) {
    return [eventType, 'birthday.upcoming', 'birthday.reminder', 'birthday.greeting', 'work_anniversary.upcoming']
  }
  return [eventType]
}

export async function previewWorkflow(input: {
  triggerType: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  event: WorkflowEvent
}): Promise<WorkflowPreviewResult> {
  try {
    const conditionResults = evaluateConditions(input.conditions, input.event)
    const matches = conditionResults.matches
    const actions: WorkflowPreviewAction[] = []

    for (const [index, action] of input.actions.entries()) {
      try {
        const title = (renderTemplate(action.title || '{{title}}', input.event) || defaultEventTitle(input.event)).slice(0, 255)
        const message = renderTemplate(action.message || action.body || '{{body}}', input.event) || defaultEventMessage(input.event)
        const body = renderTemplate(action.body || action.message || '{{body}}', input.event) || defaultEventMessage(input.event)
        const recipients = matches ? await resolveActionRecipients(action, input.event) : { users: [], externalEmails: [] }

        actions.push({
          index,
          type: action.type,
          label: getWorkflowActionLabel(action.type),
          status: matches ? 'wouldRun' : 'skipped',
          title,
          message,
          body,
          recipients: recipients.users.map((recipient) => ({
            id: recipient.id,
            fullName: recipient.fullName || 'Unknown user',
            email: recipient.email || '',
          })),
          externalEmails: recipients.externalEmails.map((recipient) => ({
            email: recipient.email,
            fullName: recipient.fullName || '',
          })),
        })
      } catch (error) {
        actions.push({
          index,
          type: action.type,
          label: getWorkflowActionLabel(action.type),
          status: 'failed',
          title: '',
          message: '',
          body: '',
          recipients: [],
          externalEmails: [],
          error: error instanceof Error ? error.message : 'Preview action failed.',
        })
      }
    }

    return {
      status: actions.some((action) => action.status === 'failed')
        ? 'failed'
        : matches
          ? 'wouldRun'
          : 'skipped',
      triggerType: input.triggerType,
      sourceType: input.event.sourceType,
      sourceId: input.event.sourceId,
      conditionResults,
      actions,
    }
  } catch (error) {
    return {
      status: 'failed',
      triggerType: input.triggerType,
      sourceType: input.event.sourceType,
      sourceId: input.event.sourceId,
      conditionResults: { matches: false, results: [] },
      actions: [],
      error: error instanceof Error ? error.message : 'Workflow preview failed.',
    }
  }
}

async function processWorkflow(
  workflow: typeof workflowsTable.$inferSelect,
  event: WorkflowEvent,
) {
  const now = new Date().toISOString()
  const [run] = await db
    .insert(workflowRunsTable)
    .values({
      workflowId: workflow.id,
      sourceEventId: event.id,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      status: 'running',
      conditionResults: {},
      startedAt: now,
    })
    .onConflictDoNothing()
    .returning()

  if (!run) return

  const conditions = normalizeWorkflowConditions(workflow.conditions)
  const conditionResults = evaluateConditions(conditions, event)

  if (!conditionResults.matches) {
    await db
      .update(workflowRunsTable)
      .set({
        status: 'skipped',
        conditionResults,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(workflowRunsTable.id, run.id))
    return
  }

  let failed = false
  for (const [index, action] of normalizeWorkflowActions(workflow.actions).entries()) {
    const actionRun = await createActionRun(run.id, index, action)
    try {
      const output = await executeWorkflowAction(action, event)
      await finishActionRun(actionRun.id, 'success', output)
    } catch (error) {
      failed = true
      await finishActionRun(actionRun.id, 'failed', {}, error)
    }
  }

  await db
    .update(workflowRunsTable)
    .set({
      status: failed ? 'failed' : 'success',
      conditionResults,
      error: failed ? 'One or more workflow actions failed.' : null,
      finishedAt: new Date().toISOString(),
    })
    .where(eq(workflowRunsTable.id, run.id))
}

function evaluateConditions(conditions: WorkflowCondition[], event: WorkflowEvent) {
  const results = conditions.map((condition) => {
    const actual = getEventValue(event, condition.field)
    return {
      field: condition.field,
      operator: condition.operator,
      expected: condition.value ?? '',
      actual,
      matches: evaluateCondition(condition, actual),
    }
  })

  return {
    matches: results.every((result) => result.matches),
    results,
  }
}

function evaluateCondition(condition: WorkflowCondition, actual: unknown) {
  const expected = condition.value ?? ''
  const actualText = actual == null ? '' : String(actual)
  const normalizedActual = normalizeConditionText(actualText)
  const normalizedExpected = normalizeConditionText(expected)

  if (condition.operator === 'equals') return normalizedActual === normalizedExpected
  if (condition.operator === 'notEquals') return normalizedActual !== normalizedExpected
  if (condition.operator === 'contains') {
    return normalizedActual.includes(normalizedExpected)
  }
  if (condition.operator === 'isEmpty') return actualText.trim() === ''
  if (condition.operator === 'isNotEmpty') return actualText.trim() !== ''
  if (condition.operator === 'greaterThan') return Number(actualText) > Number(expected)
  if (condition.operator === 'lessThan') return Number(actualText) < Number(expected)
  if (condition.operator === 'dateIsToday') return dateOnly(actualText) === dateOnly(new Date().toISOString())
  if (condition.operator === 'dateWithinNextDays') {
    const actualTime = new Date(actualText).getTime()
    if (Number.isNaN(actualTime)) return false
    const now = new Date()
    const days = Number(expected)
    const limit = new Date(now)
    limit.setDate(now.getDate() + (Number.isFinite(days) ? days : 0))
    return actualTime >= startOfDay(now).getTime() && actualTime <= endOfDay(limit).getTime()
  }

  return false
}

function normalizeConditionText(value: string) {
  return value.trim().toLowerCase()
}

async function executeWorkflowAction(action: WorkflowAction, event: WorkflowEvent) {
  if (action.type === 'sendNotification') return sendWorkflowNotification(action, event)
  if (action.type === 'sendEmail') return sendWorkflowEmail(action, event)
  if (action.type === 'createActivityLog') return createWorkflowActivityLog(action, event)
  return { skipped: true }
}

async function sendWorkflowNotification(action: WorkflowAction, event: WorkflowEvent) {
  const { users } = await resolveActionRecipients(action, event)
  if (users.length === 0) return { recipients: 0 }

  await createRenderedNotifications({
    eventType: event.eventType,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    actorUserId: event.actorUserId || null,
    title: (renderTemplate(action.title || '{{title}}', event) || defaultEventTitle(event)).slice(0, 255),
    message: renderTemplate(action.message || action.body || '{{body}}', event) || defaultEventMessage(event),
    linkUrl: stringPayload(event.payload, 'linkUrl') || '/',
    recipients: users.map((recipient) => ({
      id: recipient.id,
      email: recipient.email || '',
      fullName: recipient.fullName || '',
    })),
    metadata: event.payload,
    delivery: { inApp: true, email: false },
  })

  return { recipients: users.length }
}

async function sendWorkflowEmail(action: WorkflowAction, event: WorkflowEvent) {
  const { users, externalEmails } = await resolveActionRecipients(action, event)
  const title = (renderTemplate(action.title || '{{title}}', event) || defaultEventTitle(event)).slice(0, 255)
  const message = renderTemplate(action.message || action.body || '{{body}}', event) || defaultEventMessage(event)

  if (users.length > 0) {
    await createRenderedNotifications({
      eventType: event.eventType,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      actorUserId: event.actorUserId || null,
      title,
      message,
      linkUrl: stringPayload(event.payload, 'linkUrl') || '/',
      recipients: users.map((recipient) => ({
        id: recipient.id,
        email: recipient.email || '',
        fullName: recipient.fullName || '',
      })),
      metadata: event.payload,
      delivery: { inApp: false, email: true },
    })
  }

  for (const recipient of externalEmails) {
    await sendEmail({
      to: recipient.email,
      subject: title,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.5;"><h1 style="font-size: 20px;">${escapeHtml(title)}</h1><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p></div>`,
      text: message,
    })
  }

  return { recipients: users.length, externalEmails: externalEmails.length }
}

async function createWorkflowActivityLog(action: WorkflowAction, event: WorkflowEvent) {
  const subjectUserId = getSubjectUserId(event)
  const row = await writeMemberActivityLog({
    subjectUserId,
    actorUserId: event.actorUserId || null,
    eventType: `workflow.${event.eventType}`,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    sourceLabel: renderTemplate(action.title || '{{title}}', event) || defaultEventTitle(event),
    metadata: {
      ...event.payload,
      message: renderTemplate(action.message || action.body || '{{body}}', event) || defaultEventMessage(event),
    },
    sourceKey: `workflow:${event.id}:${subjectUserId || event.sourceId}`,
  })

  return { activityLogId: row?.id || null }
}

async function resolveActionRecipients(action: WorkflowAction, event: WorkflowEvent) {
  const selectors = action.recipients?.length
    ? action.recipients
    : ([{ type: 'eventRecipients' }] satisfies WorkflowRecipientSelector[])
  const users: Recipient[] = []
  const externalEmails: ExternalEmailRecipient[] = []

  for (const selector of selectors) {
    const result = await resolveRecipientSelector(selector, event)
    users.push(...result.users)
    externalEmails.push(...result.externalEmails)
  }

  return {
    users: dedupeUsers(users),
    externalEmails: dedupeExternalEmails(externalEmails),
  }
}

async function resolveRecipientSelector(selector: WorkflowRecipientSelector, event: WorkflowEvent) {
  if (selector.type === 'eventRecipients' || selector.type === 'mentionedUsers') {
    return { users: event.recipients, externalEmails: [] }
  }

  if (selector.type === 'triggeredEmployee') {
    return { users: await getUsersByIdsForNotifications([getSubjectUserId(event)]), externalEmails: [] }
  }

  if (selector.type === 'actor') {
    return { users: await getUsersByIdsForNotifications([event.actorUserId || '']), externalEmails: [] }
  }

  if (selector.type === 'specificUsers') {
    return { users: await getUsersByIdsForNotifications(selector.userIds || []), externalEmails: [] }
  }

  if (selector.type === 'usersWithRole') {
    return { users: await getUsersByRoleIds(selector.roleIds || []), externalEmails: [] }
  }

  if (selector.type === 'usersInDepartment') {
    return { users: await getUsersByDepartmentIds(selector.departmentIds || []), externalEmails: [] }
  }

  if (selector.type === 'admins') {
    return { users: await getFullAccessRecipientsForNotifications(), externalEmails: [] }
  }

  if (selector.type === 'employeeManager' || selector.type === 'departmentManager') {
    const departmentIds = await getSubjectDepartmentIds(event)
    return {
      users:
        departmentIds.length > 0
          ? await getDepartmentManagerRecipientsForNotifications(departmentIds)
          : await getFullAccessRecipientsForNotifications(),
      externalEmails: [],
    }
  }

  if (selector.type === 'applicantEmail') {
    const email = stringPayload(event.payload, 'email')
    return { users: [], externalEmails: email ? [{ email, fullName: stringPayload(event.payload, 'applicantName') }] : [] }
  }

  return { users: [], externalEmails: [] }
}

async function createActionRun(runId: string, actionIndex: number, action: WorkflowAction) {
  const [row] = await db
    .insert(workflowActionRunsTable)
    .values({
      workflowRunId: runId,
      actionIndex,
      actionType: action.type,
      status: 'running',
      input: action,
      startedAt: new Date().toISOString(),
    })
    .returning()

  return row
}

async function finishActionRun(
  id: string,
  status: 'success' | 'failed',
  output: Record<string, unknown>,
  error?: unknown,
) {
  await db
    .update(workflowActionRunsTable)
    .set({
      status,
      output,
      error: error instanceof Error ? error.message : error ? 'Workflow action failed.' : null,
      finishedAt: new Date().toISOString(),
    })
    .where(eq(workflowActionRunsTable.id, id))
}

function defaultWorkflowTemplates() {
  const notifyEventRecipients = (triggerType: string, name: string): typeof workflowsTable.$inferInsert => ({
    name,
    enabled: true,
    triggerType,
    actions: [
      {
        type: 'sendNotification' as const,
        title: '{{title}}',
        message: '',
        recipients: [{ type: 'eventRecipients' as const }],
      },
    ],
  })

  return [
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.calendarEventCreated, 'Default: notify new event recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.calendarEventUpdated, 'Default: notify updated event recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.calendarEventCancelled, 'Default: notify cancelled event recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.leaveRequested, 'Default: notify leave request recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.leaveUpdated, 'Default: notify leave update recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.inventoryCreated, 'Default: notify inventory created recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.inventoryUpdated, 'Default: notify inventory updated recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.applicantCreated, 'Default: notify applicant recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.employeeCreated, 'Default: notify employee created recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming, 'Default: notify upcoming calendar item recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.expenseCreated, 'Default: notify expense created recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.expenseUpdated, 'Default: notify expense updated recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.expenseGenerationDue, 'Default: notify expense generation due recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.expensePaymentDue, 'Default: notify expense payment due recipients'),
    notifyEventRecipients(WORKFLOW_TRIGGER_TYPES.expensePaymentGenerated, 'Default: notify expense payment generated recipients'),
  ]
}

function getEventValue(event: WorkflowEvent, field: string) {
  if (field === 'eventType') return event.eventType
  if (field === 'sourceType') return event.sourceType
  if (field === 'sourceId') return event.sourceId
  if (field === 'actorUserId') return event.actorUserId || ''
  return event.payload[field]
}

function renderTemplate(template: string, event: WorkflowEvent) {
  return template.replace(/\{\{([^}]+)\}\}|\{([^}]+)\}/g, (_match, doubleKey, singleKey) => {
    const key = String(doubleKey || singleKey || '').trim()
    const value = getEventValue(event, key)
    return value == null ? '' : String(value)
  })
}

function defaultEventTitle(event: WorkflowEvent) {
  const title = stringPayload(event.payload, 'title')
  if (title) return title

  if (event.eventType === WORKFLOW_TRIGGER_TYPES.calendarEventUpdated) return `Updated event: ${stringPayload(event.payload, 'title') || 'Calendar event'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.calendarEventCancelled) return `Cancelled event: ${stringPayload(event.payload, 'title') || 'Calendar event'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.leaveRequested) return 'New leave request'
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.leaveUpdated) return `Leave ${stringPayload(event.payload, 'status') || 'updated'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.payrollGenerated) return `Payroll generated for ${stringPayload(event.payload, 'month')} ${stringPayload(event.payload, 'year')}`.trim()
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.payrollStatusChanged) return `Payroll ${stringPayload(event.payload, 'status') || 'updated'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.inventoryCreated) return `New inventory item: ${stringPayload(event.payload, 'model') || 'Item'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.inventoryUpdated) return `Inventory updated: ${stringPayload(event.payload, 'model') || 'Item'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.applicantCreated) return `New applicant: ${stringPayload(event.payload, 'applicantName') || 'Applicant'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.employeeCreated) return `New employee: ${stringPayload(event.payload, 'employeeName') || 'Employee'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming) {
    const calendarItemType = stringPayload(event.payload, 'calendarItemType')
    const daysUntil = stringPayload(event.payload, 'daysUntil')
    const employeeName = stringPayload(event.payload, 'employeeName') || 'Team member'
    if (calendarItemType === 'birthday') {
      if (daysUntil === '0') return `Happy birthday, ${employeeName}!`
      return `Upcoming birthday: ${employeeName}`
    }
    if (calendarItemType === 'work_anniversary') {
      const yearsCompleted = stringPayload(event.payload, 'yearsCompleted')
      if (daysUntil === '0') return `Work anniversary: ${employeeName}`
      return `Upcoming work anniversary: ${employeeName}${yearsCompleted ? ` (${yearsCompleted} years)` : ''}`
    }
    return `Upcoming calendar item: ${stringPayload(event.payload, 'title') || 'Calendar item'}`
  }
  if (event.eventType === 'work_anniversary.upcoming') {
    const yearsCompleted = stringPayload(event.payload, 'yearsCompleted')
    const employeeName = stringPayload(event.payload, 'employeeName') || 'Team member'
    if (stringPayload(event.payload, 'isAnniversaryToday') === 'true') {
      return `Work anniversary: ${employeeName}`
    }
    return `Upcoming work anniversary: ${employeeName}${yearsCompleted ? ` (${yearsCompleted} years)` : ''}`
  }
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.expenseCreated) return `New expense: ${stringPayload(event.payload, 'name') || 'Expense'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.expenseUpdated) return `Expense updated: ${stringPayload(event.payload, 'name') || 'Expense'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.expenseGenerationDue) return `Expense generation due: ${stringPayload(event.payload, 'name') || 'Expense'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.expensePaymentDue) return `Expense payment due: ${stringPayload(event.payload, 'name') || 'Expense'}`
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.expensePaymentGenerated) return `Expense transaction generated: ${stringPayload(event.payload, 'name') || 'Expense'}`

  return 'Notification'
}

function defaultEventMessage(event: WorkflowEvent) {
  const message = stringPayload(event.payload, 'message') || stringPayload(event.payload, 'body')
  if (message) return message

  if (event.eventType === WORKFLOW_TRIGGER_TYPES.leaveRequested) {
    return `${stringPayload(event.payload, 'leaveType') || 'Leave'} requested from ${stringPayload(event.payload, 'startDate')} to ${stringPayload(event.payload, 'endDate')}`
  }
  if (event.eventType === WORKFLOW_TRIGGER_TYPES.leaveUpdated) {
    return `${stringPayload(event.payload, 'leaveType') || 'Leave'} status changed from ${stringPayload(event.payload, 'previousStatus')} to ${stringPayload(event.payload, 'status')}`
  }
  if (event.sourceType === 'payroll') return `Payroll amount: ${stringPayload(event.payload, 'totalAmount') || 'N/A'}`
  if (event.sourceType === 'inventory') return `Serial: ${stringPayload(event.payload, 'serialNumber')}\nStatus: ${stringPayload(event.payload, 'status')}`
  if (event.sourceType === 'applicant') return `${stringPayload(event.payload, 'position')}\n${stringPayload(event.payload, 'email')}`.trim()
  if (event.sourceType === 'employee') return `${stringPayload(event.payload, 'jobTitle') || 'Team member'} joined LibreStaff.`
  if (event.sourceType === 'birthday') return `${stringPayload(event.payload, 'employeeName') || 'A team member'} has a birthday on ${stringPayload(event.payload, 'birthdayDate')}.`
  if (event.sourceType === 'work_anniversary') {
    return `${stringPayload(event.payload, 'employeeName') || 'A team member'} reaches ${stringPayload(event.payload, 'yearsCompleted') || 'a'} year anniversary on ${stringPayload(event.payload, 'anniversaryDate')}.`
  }
  if (event.sourceType === 'calendar_item') {
    const calendarItemType = stringPayload(event.payload, 'calendarItemType')
    if (calendarItemType === 'birthday') {
      return `${stringPayload(event.payload, 'employeeName') || 'A team member'} has a birthday on ${stringPayload(event.payload, 'date')}.`
    }
    if (calendarItemType === 'work_anniversary') {
      return `${stringPayload(event.payload, 'employeeName') || 'A team member'} reaches ${stringPayload(event.payload, 'yearsCompleted') || 'a'} year anniversary on ${stringPayload(event.payload, 'date')}.`
    }
    return `${stringPayload(event.payload, 'title') || 'A calendar item'} is coming up on ${stringPayload(event.payload, 'date')}.`
  }
  if (event.sourceType === 'expense' || event.sourceType === 'expense_payment') return `${stringPayload(event.payload, 'category')} expense: ${stringPayload(event.payload, 'amount')}`.trim()
  if (event.sourceType === 'event') return [event.payload.description, event.payload.timeLabel, event.payload.location].filter(Boolean).join('\n')

  return defaultEventTitle(event)
}

function getSubjectUserId(event: WorkflowEvent) {
  return (
    stringPayload(event.payload, 'subjectUserId') ||
    stringPayload(event.payload, 'employeeId') ||
    stringPayload(event.payload, 'userId') ||
    stringPayload(event.payload, 'birthdayUserId') ||
    stringPayload(event.payload, 'holderId')
  )
}

async function getSubjectDepartmentIds(event: WorkflowEvent) {
  const explicitDepartmentId = stringPayload(event.payload, 'departmentId')
  if (explicitDepartmentId) {
    const [department] = await getDepartmentRowsByIds([explicitDepartmentId])
    if (department) {
      const departmentIds = await getDepartmentIdsWithAncestors(explicitDepartmentId)
      if (departmentIds.length > 0) return departmentIds
    }
  }

  const subjectUserId = getSubjectUserId(event)
  if (!subjectUserId) return []

  const [user] = await db
    .select({ departmentId: usersTable.departmentId })
    .from(usersTable)
    .where(eq(usersTable.id, subjectUserId))
    .limit(1)

  return getDepartmentIdsWithAncestors(user?.departmentId)
}

async function getUsersByRoleIds(roleIds: string[]) {
  const ids = Array.from(new Set(roleIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.roleId, ids)))
}

async function getUsersByIdsForNotifications(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, ids)))
}

async function getUsersByDepartmentIds(departmentIds: string[]) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), inArray(usersTable.departmentId, ids)))
}

async function getFullAccessRecipientsForNotifications() {
  return db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.isActive, true), eq(rolesTable.name, 'admin')))
}

async function getDepartmentManagerRecipientsForNotifications(departmentIds: string[]) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
    .from(departmentsTable)
    .innerJoin(usersTable, eq(departmentsTable.managerUserId, usersTable.id))
    .where(and(eq(usersTable.isActive, true), inArray(departmentsTable.id, ids)))
}

function dedupeUsers(recipients: Recipient[]) {
  const seen = new Set<string>()
  return recipients.filter((recipient) => {
    if (!recipient.id || seen.has(recipient.id)) return false
    seen.add(recipient.id)
    return true
  })
}

function dedupeExternalEmails(recipients: ExternalEmailRecipient[]) {
  const seen = new Set<string>()
  return recipients.filter((recipient) => {
    const email = recipient.email.trim().toLowerCase()
    if (!email || seen.has(email)) return false
    seen.add(email)
    return true
  })
}

function stringPayload(payload: NotificationOutboxPayload, key: string) {
  const value = payload[key]
  return value == null ? '' : String(value)
}

function dateOnly(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
