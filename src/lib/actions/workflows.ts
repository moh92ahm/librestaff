'use server'

import { revalidatePath } from 'next/cache'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  workflowActionRunsTable,
  workflowRunsTable,
  workflowsTable,
  usersTable,
  type WorkflowAction,
  type WorkflowCondition,
  type WorkflowRecipientSelector,
} from '@/db/schema'
import { requireAdmin } from '@/lib/auth-guards'
import {
  WORKFLOW_ACTION_DEFINITIONS,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_RECIPIENT_DEFINITIONS,
  getWorkflowSamplePayload,
  getWorkflowTriggerDefinition,
  normalizeWorkflowActions,
  normalizeWorkflowConditions,
  normalizeWorkflowTriggerType,
} from '@/lib/workflow-definitions'
import { previewWorkflow } from '@/lib/workflows'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

function indexedValues(formData: FormData, prefix: string) {
  const result: Record<number, Record<string, string[]>> = {}
  for (const [key, value] of formData.entries()) {
    const match = key.match(new RegExp(`^${prefix}\\[(\\d+)\\]\\[(.+)\\]$`))
    if (!match) continue
    const index = Number(match[1])
    const field = match[2]
    result[index] ||= {}
    result[index][field] ||= []
    result[index][field].push(String(value))
  }

  return Object.entries(result)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, fields]) => fields)
}

function parseConditions(formData: FormData): WorkflowCondition[] {
  return normalizeWorkflowConditions(
    indexedValues(formData, 'conditions').map((condition) => ({
      field: condition.field?.[0],
      operator: condition.operator?.[0],
      value: condition.value?.[0],
    })),
  ).filter((condition) => {
    const operator = WORKFLOW_CONDITION_OPERATORS.find((item) => item.value === condition.operator)
    return condition.field && (!operator?.requiresValue || String(condition.value || '').trim())
  })
}

function parseActions(formData: FormData): WorkflowAction[] {
  return normalizeWorkflowActions(
    indexedValues(formData, 'actions').map((action) => ({
      type: action.type?.[0],
      title: action.title?.[0],
      message: action.message?.[0],
      body: action.body?.[0],
      categoryId: action.categoryId?.[0],
      recipients: parseRecipients(action),
    })),
  )
}

function parseRecipients(action: Record<string, string[]>): WorkflowRecipientSelector[] {
  const recipientTypes = action.recipientTypes || []
  return recipientTypes
    .map((type) => ({
      type,
      userIds: action.userIds || [],
      roleIds: action.roleIds || [],
      departmentIds: action.departmentIds || [],
    }))
    .filter((recipient) =>
      WORKFLOW_RECIPIENT_DEFINITIONS.some((definition) => definition.type === recipient.type),
    ) as WorkflowRecipientSelector[]
}

function validateWorkflow(input: {
  name: string
  triggerType: string
  actions: WorkflowAction[]
}) {
  if (!input.name) throw new Error('Workflow name is required.')
  if (!getWorkflowTriggerDefinition(input.triggerType)) throw new Error('Choose a valid trigger.')
  if (input.actions.length === 0) throw new Error('Add at least one action.')
  for (const action of input.actions) {
    if (!WORKFLOW_ACTION_DEFINITIONS.some((definition) => definition.type === action.type)) {
      throw new Error('Choose a valid action.')
    }
  }
}

export async function saveWorkflowAction(formData: FormData) {
  const user = await requireAdmin()
  const id = clean(formData.get('id'))
  const name = clean(formData.get('name'))
  const triggerType = normalizeWorkflowTriggerType(clean(formData.get('triggerType')))
  const enabled = formData.get('enabled') === 'on'
  const conditions = parseConditions(formData)
  const actions = parseActions(formData)
  const now = new Date().toISOString()

  validateWorkflow({ name, triggerType, actions })

  if (id) {
    await db
      .update(workflowsTable)
      .set({
        name,
        enabled,
        triggerType,
        triggerConfig: {},
        conditions,
        actions,
        updatedAt: now,
      })
      .where(eq(workflowsTable.id, id))
  } else {
    await db.insert(workflowsTable).values({
      name,
      enabled,
      triggerType,
      triggerConfig: {},
      conditions,
      actions,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    })
  }

  revalidatePath('/settings/workflows')
}

export async function testWorkflowAction(formData: FormData) {
  const user = await requireAdmin()
  const name = clean(formData.get('name')) || 'Untitled workflow'
  const triggerType = normalizeWorkflowTriggerType(clean(formData.get('triggerType')))
  const conditions = parseConditions(formData)
  const actions = parseActions(formData)
  const definition = getWorkflowTriggerDefinition(triggerType)

  validateWorkflow({ name, triggerType, actions })
  if (!definition) throw new Error('Choose a valid trigger.')

  const payload = {
    ...getWorkflowSamplePayload(triggerType),
    ...parseSamplePayload(formData),
  }
  const sourceType = getPreviewSourceType(triggerType, definition.source)
  const sourceId = String(payload.sourceId || `preview-${triggerType}`)
  const eventRecipients = await getPreviewEventRecipients(String(payload.employeeId || ''), user)

  return previewWorkflow({
    triggerType,
    conditions,
    actions,
    event: {
      id: `preview-${crypto.randomUUID()}`,
      eventType: triggerType,
      sourceType,
      sourceId,
      actorUserId: user.id,
      recipients: eventRecipients,
      payload,
    },
  })
}

async function getPreviewEventRecipients(employeeId: string, fallbackUser: Awaited<ReturnType<typeof requireAdmin>>) {
  if (employeeId) {
    const [employee] = await db
      .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, employeeId))
      .limit(1)

    if (employee) {
      return [{ id: employee.id, email: employee.email || null, fullName: employee.fullName || null }]
    }
  }

  return [
    {
      id: fallbackUser.id,
      email: fallbackUser.email || null,
      fullName: fallbackUser.name || 'Current admin',
    },
  ]
}

function parseSamplePayload(formData: FormData) {
  const payload: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^samplePayload\[(.+)\]$/)
    if (!match) continue
    payload[match[1]] = String(value)
  }
  return payload
}

function getPreviewSourceType(triggerType: string, source: string) {
  if (triggerType === 'calendar_item.upcoming') return 'calendar_item'
  if (triggerType.startsWith('calendar_event.')) return 'event'
  if (triggerType.startsWith('expense.payment_')) return 'expense_payment'
  return source.toLowerCase()
}

export async function toggleWorkflowAction(formData: FormData) {
  await requireAdmin()
  const id = clean(formData.get('id'))
  if (!id) throw new Error('Workflow ID is required.')

  const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id)).limit(1)
  if (!workflow) throw new Error('Workflow not found.')

  await db
    .update(workflowsTable)
    .set({ enabled: !workflow.enabled, updatedAt: new Date().toISOString() })
    .where(eq(workflowsTable.id, id))

  revalidatePath('/settings/workflows')
}

export async function duplicateWorkflowAction(formData: FormData) {
  const user = await requireAdmin()
  const id = clean(formData.get('id'))
  if (!id) throw new Error('Workflow ID is required.')

  const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id)).limit(1)
  if (!workflow) throw new Error('Workflow not found.')

  const now = new Date().toISOString()
  await db.insert(workflowsTable).values({
    name: `${workflow.name} copy`,
    enabled: false,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig,
    conditions: normalizeWorkflowConditions(workflow.conditions),
    actions: normalizeWorkflowActions(workflow.actions),
    createdById: user.id,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath('/settings/workflows')
}

export async function deleteWorkflowAction(formData: FormData) {
  await requireAdmin()
  const id = clean(formData.get('id'))
  if (!id) throw new Error('Workflow ID is required.')

  const runRows = await db
    .select({ id: workflowRunsTable.id })
    .from(workflowRunsTable)
    .where(eq(workflowRunsTable.workflowId, id))
  const runIds = runRows.map((run) => run.id)

  await db.transaction(async (tx) => {
    if (runIds.length > 0) {
      await tx
        .delete(workflowActionRunsTable)
        .where(
          runIds.length === 1
            ? eq(workflowActionRunsTable.workflowRunId, runIds[0])
            : inArray(workflowActionRunsTable.workflowRunId, runIds),
        )
      await tx.delete(workflowRunsTable).where(eq(workflowRunsTable.workflowId, id))
    }

    await tx.delete(workflowsTable).where(eq(workflowsTable.id, id))
  })

  revalidatePath('/settings/workflows')
}
