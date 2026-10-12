import { describe, expect, it, vi } from 'vitest'
import {
  WORKFLOW_ACTION_DEFINITIONS,
  WORKFLOW_CONDITION_OPERATORS,
  WORKFLOW_RECIPIENT_DEFINITIONS,
  WORKFLOW_TRIGGER_DEFINITIONS,
  getWorkflowSamplePayload,
  getWorkflowTriggerDefinition,
  normalizeWorkflowActions,
  normalizeWorkflowConditions,
} from '@/lib/workflow-definitions'
import { previewWorkflow } from '@/lib/workflows'

describe('workflow definitions', () => {
  it('exposes the v1 trigger/action/recipient registry', () => {
    expect(getWorkflowTriggerDefinition('leave.requested')?.label).toBe('Leave is requested')
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).toContain(
      'calendar_item.upcoming',
    )
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).not.toContain(
      'birthday.upcoming',
    )
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).not.toContain(
      'work_anniversary.upcoming',
    )
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).not.toContain(
      'payroll.paid',
    )
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).not.toContain(
      'birthday.greeting',
    )
    expect(getWorkflowTriggerDefinition('birthday.greeting')?.type).toBe('calendar_item.upcoming')
    expect(getWorkflowTriggerDefinition('payroll.paid')?.type).toBe('payroll.status_changed')
    expect(WORKFLOW_TRIGGER_DEFINITIONS.map((trigger) => trigger.type)).not.toContain(
      'announcement.posted',
    )
    expect(WORKFLOW_ACTION_DEFINITIONS.map((action) => action.type)).toEqual([
      'sendNotification',
      'sendEmail',
      'createActivityLog',
    ])
    expect(WORKFLOW_RECIPIENT_DEFINITIONS.map((recipient) => recipient.type)).toContain('admins')
    expect(WORKFLOW_RECIPIENT_DEFINITIONS.map((recipient) => recipient.type)).not.toContain(
      'announcementChannelMembers',
    )
    expect(WORKFLOW_CONDITION_OPERATORS.map((operator) => operator.value)).toContain(
      'dateWithinNextDays',
    )
  })

  it('normalizes workflow conditions', () => {
    expect(
      normalizeWorkflowConditions([
        { field: ' title ', operator: 'contains', value: 'Ada' },
        { field: '', operator: 'equals', value: 'ignored' },
        { field: 'status', operator: 'bad', value: 'approved' },
      ]),
    ).toEqual([
      { field: 'title', operator: 'contains', value: 'Ada' },
      { field: 'status', operator: 'equals', value: 'approved' },
    ])
  })

  it('normalizes workflow actions and recipient selectors', () => {
    expect(
      normalizeWorkflowActions([
        {
          type: 'sendEmail',
          title: 'Hello',
          recipients: [
            {
              type: 'usersWithRole',
              roleIds: ['role-1', 'role-1', ''],
            },
          ],
        },
        { type: 'bad-action' },
      ]),
    ).toEqual([
      {
        type: 'sendEmail',
        title: 'Hello',
        message: undefined,
        body: undefined,
        categoryId: undefined,
        recipients: [
          {
            type: 'usersWithRole',
            userIds: [],
            roleIds: ['role-1'],
            departmentIds: [],
          },
        ],
      },
      {
        type: 'sendNotification',
        title: undefined,
        message: undefined,
        body: undefined,
        categoryId: undefined,
        recipients: [],
      },
    ])
  })

  it('generates trigger-specific sample payloads for previews', () => {
    expect(getWorkflowSamplePayload('leave.requested')).toMatchObject({
      employeeName: 'Alex Morgan',
      leaveType: 'Annual',
      totalDays: '5',
    })
    expect(getWorkflowSamplePayload('calendar_item.upcoming')).toMatchObject({
      employeeName: 'Alex Morgan',
      calendarItemType: 'birthday',
      date: expect.any(String),
      daysUntil: '0',
    })
    expect(getWorkflowSamplePayload('payroll.generated')).toMatchObject({
      payrollId: 'sample-payroll-id',
      employeeName: 'Alex Morgan',
      totalAmount: '2500',
    })
  })

  it('previews a workflow without executing real actions', async () => {
    const result = await previewWorkflow({
      triggerType: 'leave.requested',
      conditions: [
        { field: 'leaveType', operator: 'equals', value: 'Annual' },
        { field: 'status', operator: 'equals', value: 'PENDING' },
      ],
      actions: [
        {
          type: 'sendNotification',
          title: 'Leave request from {{employeeName}}',
          message: '{{employeeName}} requested {{totalDays}} days.',
          recipients: [{ type: 'eventRecipients' }],
        },
      ],
      event: {
        id: 'preview-1',
        eventType: 'leave.requested',
        sourceType: 'leave',
        sourceId: 'leave-1',
        actorUserId: 'user-1',
        recipients: [{ id: 'manager-1', email: 'manager@example.com', fullName: 'Manager One' }],
        payload: {
          employeeName: 'Alex Morgan',
          leaveType: 'Annual',
          status: 'pending',
          totalDays: '5',
          title: 'New leave request',
        },
      },
    })

    expect(result.status).toBe('wouldRun')
    expect(result.conditionResults.matches).toBe(true)
    expect(result.actions[0]).toMatchObject({
      status: 'wouldRun',
      title: 'Leave request from Alex Morgan',
      message: 'Alex Morgan requested 5 days.',
      recipients: [{ id: 'manager-1', email: 'manager@example.com', fullName: 'Manager One' }],
    })
  })

  it('marks preview actions skipped when conditions do not match', async () => {
    const result = await previewWorkflow({
      triggerType: 'leave.requested',
      conditions: [{ field: 'leaveType', operator: 'equals', value: 'Sick' }],
      actions: [
        {
          type: 'sendEmail',
          title: '{{title}}',
          message: '{{leaveType}} leave',
          recipients: [{ type: 'eventRecipients' }],
        },
      ],
      event: {
        id: 'preview-2',
        eventType: 'leave.requested',
        sourceType: 'leave',
        sourceId: 'leave-2',
        actorUserId: 'user-1',
        recipients: [{ id: 'manager-1', email: 'manager@example.com', fullName: 'Manager One' }],
        payload: {
          title: 'New leave request',
          leaveType: 'Annual',
        },
      },
    })

    expect(result.status).toBe('skipped')
    expect(result.conditionResults.matches).toBe(false)
    expect(result.actions[0]).toMatchObject({
      status: 'skipped',
      title: 'New leave request',
      recipients: [],
    })
  })

  it('falls back to the selected employee department when preview sample department id is not real', async () => {
    vi.resetModules()

    const userLimit = vi.fn().mockResolvedValue([{ departmentId: 'dept-marketing' }])
    const userWhere = vi.fn(() => ({ limit: userLimit }))
    const userFrom = vi.fn(() => ({ where: userWhere }))
    const managerWhere = vi.fn().mockResolvedValue([
      { id: 'user-shuri', email: 'shuri@example.com', fullName: 'Shuri' },
    ])
    const innerJoin = vi.fn(() => ({ where: managerWhere }))
    const managerFrom = vi.fn(() => ({ innerJoin }))
    const select = vi.fn()
      .mockReturnValueOnce({ from: userFrom })
      .mockReturnValueOnce({ from: managerFrom })

    vi.doMock('@/db', () => ({ db: { select } }))
    vi.doMock('@/lib/department-hierarchy', () => ({
      getDepartmentIdsWithAncestors: vi.fn(async (departmentId: string | null | undefined) =>
        departmentId === 'dept-marketing' ? ['dept-marketing'] : [String(departmentId || '')].filter(Boolean),
      ),
      getDepartmentRowsByIds: vi.fn(async (departmentIds: string[]) =>
        departmentIds.includes('dept-marketing')
          ? [{ id: 'dept-marketing', parentDepartmentId: null }]
          : [],
      ),
    }))

    const { previewWorkflow } = await import('@/lib/workflows')
    const result = await previewWorkflow({
      triggerType: 'calendar_item.upcoming',
      conditions: [],
      actions: [
        {
          type: 'sendNotification',
          title: '{{title}}',
          message: '',
          recipients: [{ type: 'employeeManager' }],
        },
      ],
      event: {
        id: 'preview-manager',
        eventType: 'calendar_item.upcoming',
        sourceType: 'calendar_item',
        sourceId: 'preview-calendar-item',
        recipients: [{ id: 'user-kamala', email: 'kamala@example.com', fullName: 'Kamala Khan' }],
        payload: {
          title: 'Upcoming birthday',
          calendarItemType: 'birthday',
          employeeId: 'user-kamala',
          employeeName: 'Kamala Khan',
          departmentId: 'sample-department-id',
          date: '2026-07-24',
          daysUntil: '0',
        },
      },
    })

    expect(result.actions[0]?.recipients).toEqual([
      { id: 'user-shuri', email: 'shuri@example.com', fullName: 'Shuri' },
    ])
  })
})
