import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowConditionOperator,
  WorkflowRecipientSelector,
} from '@/db/schema'

export const WORKFLOW_TRIGGER_TYPES = {
  calendarItemUpcoming: 'calendar_item.upcoming',
  calendarEventCreated: 'calendar_event.created',
  calendarEventUpdated: 'calendar_event.updated',
  calendarEventCancelled: 'calendar_event.cancelled',
  leaveRequested: 'leave.requested',
  leaveUpdated: 'leave.updated',
  payrollGenerated: 'payroll.generated',
  payrollStatusChanged: 'payroll.status_changed',
  inventoryCreated: 'inventory.created',
  inventoryUpdated: 'inventory.updated',
  applicantCreated: 'applicant.created',
  employeeCreated: 'employee.created',
  expenseCreated: 'expense.created',
  expenseUpdated: 'expense.updated',
  expenseGenerationDue: 'expense.generation_due',
  expensePaymentDue: 'expense.payment_due',
  expensePaymentGenerated: 'expense.payment_generated',
} as const

export type WorkflowTriggerDefinition = {
  type: string
  label: string
  source: string
  fields: Array<{ value: string; label: string }>
}

export type WorkflowActionDefinition = {
  type: WorkflowAction['type']
  label: string
}

export type WorkflowRecipientDefinition = {
  type: WorkflowRecipientSelector['type']
  label: string
}

export const WORKFLOW_TRIGGER_DEFINITIONS: WorkflowTriggerDefinition[] = [
  { type: WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming, label: 'Calendar item is upcoming', source: 'Calendar', fields: calendarUpcomingFields() },
  { type: WORKFLOW_TRIGGER_TYPES.calendarEventCreated, label: 'Calendar event is created', source: 'Calendar', fields: eventFields() },
  { type: WORKFLOW_TRIGGER_TYPES.calendarEventUpdated, label: 'Calendar event is updated', source: 'Calendar', fields: eventFields() },
  { type: WORKFLOW_TRIGGER_TYPES.calendarEventCancelled, label: 'Calendar event is cancelled', source: 'Calendar', fields: eventFields() },
  { type: WORKFLOW_TRIGGER_TYPES.leaveRequested, label: 'Leave is requested', source: 'Leave', fields: leaveFields() },
  { type: WORKFLOW_TRIGGER_TYPES.leaveUpdated, label: 'Leave is updated', source: 'Leave', fields: leaveFields() },
  { type: WORKFLOW_TRIGGER_TYPES.payrollGenerated, label: 'Payroll is generated', source: 'Payroll', fields: payrollFields() },
  { type: WORKFLOW_TRIGGER_TYPES.payrollStatusChanged, label: 'Payroll status changes', source: 'Payroll', fields: payrollFields() },
  { type: WORKFLOW_TRIGGER_TYPES.inventoryCreated, label: 'Inventory item is created', source: 'Inventory', fields: inventoryFields() },
  { type: WORKFLOW_TRIGGER_TYPES.inventoryUpdated, label: 'Inventory item is updated', source: 'Inventory', fields: inventoryFields() },
  { type: WORKFLOW_TRIGGER_TYPES.applicantCreated, label: 'Applicant is created', source: 'Applicant', fields: applicantFields() },
  { type: WORKFLOW_TRIGGER_TYPES.employeeCreated, label: 'Employee is created', source: 'Employee', fields: employeeCreatedFields() },
  { type: WORKFLOW_TRIGGER_TYPES.expenseCreated, label: 'Expense is created', source: 'Expense', fields: expenseFields() },
  { type: WORKFLOW_TRIGGER_TYPES.expenseUpdated, label: 'Expense is updated', source: 'Expense', fields: expenseFields() },
  { type: WORKFLOW_TRIGGER_TYPES.expenseGenerationDue, label: 'Expense generation is due', source: 'Expense', fields: expenseFields() },
  { type: WORKFLOW_TRIGGER_TYPES.expensePaymentDue, label: 'Expense payment is due', source: 'Expense', fields: expenseFields() },
  { type: WORKFLOW_TRIGGER_TYPES.expensePaymentGenerated, label: 'Expense payment is generated', source: 'Expense', fields: expenseFields() },
]

export const WORKFLOW_CONDITION_OPERATORS: Array<{
  value: WorkflowConditionOperator
  label: string
  requiresValue: boolean
}> = [
  { value: 'equals', label: 'equals', requiresValue: true },
  { value: 'notEquals', label: 'does not equal', requiresValue: true },
  { value: 'contains', label: 'contains', requiresValue: true },
  { value: 'isEmpty', label: 'is empty', requiresValue: false },
  { value: 'isNotEmpty', label: 'is not empty', requiresValue: false },
  { value: 'greaterThan', label: 'is greater than', requiresValue: true },
  { value: 'lessThan', label: 'is less than', requiresValue: true },
  { value: 'dateIsToday', label: 'is today', requiresValue: false },
  { value: 'dateWithinNextDays', label: 'is within next days', requiresValue: true },
]

export const WORKFLOW_ACTION_DEFINITIONS: WorkflowActionDefinition[] = [
  { type: 'sendNotification', label: 'Send in-app notification' },
  { type: 'sendEmail', label: 'Send email' },
  { type: 'createActivityLog', label: 'Create member activity log' },
]

export const WORKFLOW_RECIPIENT_DEFINITIONS: WorkflowRecipientDefinition[] = [
  { type: 'triggeredEmployee', label: 'Triggered employee' },
  { type: 'actor', label: 'Actor who caused the event' },
  { type: 'employeeManager', label: 'Employee manager' },
  { type: 'departmentManager', label: 'Department manager' },
  { type: 'mentionedUsers', label: 'Mentioned users' },
  { type: 'eventRecipients', label: 'Event recipients' },
  { type: 'specificUsers', label: 'Specific users' },
  { type: 'usersWithRole', label: 'Users with role' },
  { type: 'usersInDepartment', label: 'Users in department' },
  { type: 'admins', label: 'Admins' },
  { type: 'applicantEmail', label: 'Applicant email' },
]

export function getWorkflowTriggerDefinition(type: string) {
  const normalizedType = normalizeWorkflowTriggerType(type)
  return WORKFLOW_TRIGGER_DEFINITIONS.find((definition) => definition.type === normalizedType) || null
}

export function normalizeWorkflowTriggerType(type: string) {
  if (
    type === 'birthday.reminder' ||
    type === 'birthday.greeting' ||
    type === 'birthday.upcoming' ||
    type === 'work_anniversary.upcoming'
  ) {
    return WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming
  }
  if (type === 'payroll.paid') return WORKFLOW_TRIGGER_TYPES.payrollStatusChanged
  return type
}

export function getWorkflowActionLabel(type: WorkflowAction['type']) {
  return WORKFLOW_ACTION_DEFINITIONS.find((definition) => definition.type === type)?.label || type
}

export function getWorkflowSamplePayload(triggerType: string): Record<string, string> {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const nextWeek = addDays(today, 7)
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = String(today.getFullYear())

  const common = {
    title: 'Sample workflow event',
    body: 'This is sample content for the workflow preview.',
    status: 'active',
    employeeId: 'sample-employee-id',
    employeeName: 'Alex Morgan',
    departmentId: 'sample-department-id',
  }

  if (triggerType === WORKFLOW_TRIGGER_TYPES.calendarItemUpcoming) {
    return {
      ...common,
      title: 'Upcoming birthday',
      calendarItemType: 'birthday',
      date: today.toISOString().slice(0, 10),
      daysUntil: '0',
      jobTitle: 'Product Designer',
      linkUrl: '/users/sample-employee-id',
    }
  }

  if (triggerType.startsWith('calendar_event.')) {
    return {
      ...common,
      eventId: 'sample-event-id',
      title: 'Team planning meeting',
      body: 'Discuss priorities and blockers.',
      timeLabel: `${tomorrow.toISOString().slice(0, 10)} 09:00`,
      location: 'Main meeting room',
    }
  }

  if (triggerType.startsWith('leave.')) {
    return {
      ...common,
      title: 'New leave request',
      status: triggerType === WORKFLOW_TRIGGER_TYPES.leaveUpdated ? 'approved' : 'pending',
      previousStatus: 'pending',
      leaveType: 'Annual',
      startDate: tomorrow.toISOString().slice(0, 10),
      endDate: nextWeek.toISOString().slice(0, 10),
      totalDays: '5',
    }
  }

  if (triggerType.startsWith('payroll.')) {
    return {
      ...common,
      payrollId: 'sample-payroll-id',
      title: 'Payroll updated',
      status: triggerType === WORKFLOW_TRIGGER_TYPES.payrollStatusChanged ? 'paid' : 'generated',
      previousStatus: 'draft',
      month,
      year,
      totalAmount: '2500',
    }
  }

  if (triggerType.startsWith('inventory.')) {
    return {
      ...common,
      title: 'Inventory updated',
      status: 'assigned',
      model: 'MacBook Pro 14',
      serialNumber: 'SN-12345',
      holderId: 'sample-holder-id',
    }
  }

  if (triggerType === WORKFLOW_TRIGGER_TYPES.applicantCreated) {
    return {
      ...common,
      title: 'New applicant',
      status: 'new',
      applicantName: 'Jordan Lee',
      position: 'Software Engineer',
      email: 'candidate@example.com',
    }
  }

  if (triggerType === WORKFLOW_TRIGGER_TYPES.employeeCreated) {
    return {
      ...common,
      title: 'New employee',
      status: 'active',
      jobTitle: 'Product Designer',
      linkUrl: '/users/sample-employee-id',
    }
  }

  if (triggerType.startsWith('expense.')) {
    return {
      ...common,
      title: 'Expense due',
      status: 'pending',
      name: 'Office software subscription',
      amount: '120',
      category: 'Software',
      vendor: 'Acme SaaS',
      dueDate: nextWeek.toISOString().slice(0, 10),
      generationDate: tomorrow.toISOString().slice(0, 10),
    }
  }

  return common
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

export function normalizeWorkflowConditions(value: unknown): WorkflowCondition[] {
  return Array.isArray(value)
    ? value
        .map((condition) => {
          const item = condition as Partial<WorkflowCondition>
          return {
            field: String(item.field || '').trim(),
            operator: isConditionOperator(item.operator) ? item.operator : 'equals',
            value: item.value == null ? '' : String(item.value),
          }
        })
        .filter((condition) => condition.field)
    : []
}

export function normalizeWorkflowActions(value: unknown): WorkflowAction[] {
  return Array.isArray(value)
    ? value
        .map((action) => {
          const item = action as Partial<WorkflowAction>
          return {
            type: isActionType(item.type) ? item.type : 'sendNotification',
            title: stringOrUndefined(item.title),
            message: stringOrUndefined(item.message),
            body: stringOrUndefined(item.body),
            categoryId: stringOrUndefined(item.categoryId),
            recipients: normalizeRecipients(item.recipients),
          }
        })
        .filter((action) => action.type)
    : []
}

function normalizeRecipients(value: unknown): WorkflowRecipientSelector[] {
  if (!Array.isArray(value)) return []

  return value
    .map((recipient) => {
      const item = recipient as Partial<WorkflowRecipientSelector>
      return {
        type: isRecipientType(item.type) ? item.type : 'eventRecipients',
        userIds: arrayOfStrings(item.userIds),
        roleIds: arrayOfStrings(item.roleIds),
        departmentIds: arrayOfStrings(item.departmentIds),
      }
    })
    .filter((recipient) => recipient.type)
}

function isConditionOperator(value: unknown): value is WorkflowConditionOperator {
  return WORKFLOW_CONDITION_OPERATORS.some((operator) => operator.value === value)
}

function isActionType(value: unknown): value is WorkflowAction['type'] {
  return WORKFLOW_ACTION_DEFINITIONS.some((action) => action.type === value)
}

function isRecipientType(value: unknown): value is WorkflowRecipientSelector['type'] {
  return WORKFLOW_RECIPIENT_DEFINITIONS.some((recipient) => recipient.type === value)
}

function stringOrUndefined(value: unknown) {
  const text = String(value || '').trim()
  return text || undefined
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : []
}

function commonFields() {
  return [
    { value: 'title', label: 'Title' },
    { value: 'body', label: 'Body' },
    { value: 'status', label: 'Status' },
    { value: 'employeeId', label: 'Employee ID' },
    { value: 'employeeName', label: 'Employee name' },
    { value: 'departmentId', label: 'Department ID' },
  ]
}

function employeeCreatedFields() {
  return [
    ...commonFields(),
    { value: 'jobTitle', label: 'Job title' },
    { value: 'linkUrl', label: 'Link URL' },
  ]
}

function calendarUpcomingFields() {
  return [
    { value: 'title', label: 'Title' },
    { value: 'calendarItemType', label: 'Calendar item type' },
    { value: 'date', label: 'Date' },
    { value: 'daysUntil', label: 'Days until' },
    { value: 'employeeName', label: 'Employee name' },
    { value: 'jobTitle', label: 'Job title' },
    { value: 'joinedAt', label: 'Joined date' },
    { value: 'yearsCompleted', label: 'Years completed' },
    { value: 'linkUrl', label: 'Link URL' },
  ]
}

function eventFields() {
  return [
    ...commonFields(),
    { value: 'eventId', label: 'Event ID' },
    { value: 'timeLabel', label: 'Time' },
    { value: 'location', label: 'Location' },
  ]
}

function leaveFields() {
  return [
    ...commonFields(),
    { value: 'leaveType', label: 'Leave type' },
    { value: 'startDate', label: 'Start date' },
    { value: 'endDate', label: 'End date' },
    { value: 'totalDays', label: 'Total days' },
    { value: 'previousStatus', label: 'Previous status' },
  ]
}

function applicantFields() {
  return [
    ...commonFields(),
    { value: 'applicantName', label: 'Applicant name' },
    { value: 'position', label: 'Position' },
    { value: 'email', label: 'Email' },
  ]
}

function inventoryFields() {
  return [
    ...commonFields(),
    { value: 'model', label: 'Model' },
    { value: 'serialNumber', label: 'Serial number' },
    { value: 'holderId', label: 'Holder ID' },
  ]
}

function payrollFields() {
  return [
    ...commonFields(),
    { value: 'payrollId', label: 'Payroll ID' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'totalAmount', label: 'Total amount' },
    { value: 'previousStatus', label: 'Previous status' },
  ]
}

function expenseFields() {
  return [
    ...commonFields(),
    { value: 'name', label: 'Expense name' },
    { value: 'amount', label: 'Amount' },
    { value: 'category', label: 'Category' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'dueDate', label: 'Due date' },
    { value: 'generationDate', label: 'Generation date' },
  ]
}
