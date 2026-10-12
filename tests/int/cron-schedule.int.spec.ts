import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('cron schedule helpers', () => {
  it('validates schedule inputs', async () => {
    const {
      normalizeIntervalMinutes,
      normalizeMonthlyDay,
      normalizeTime,
      normalizeTimezone,
    } = await import('@/lib/cron-schedule')

    expect(normalizeTime('08:30', '08:00')).toBe('08:30')
    expect(() => normalizeTime('25:00', '08:00')).toThrow('Time must be between 00:00 and 23:59.')
    expect(normalizeMonthlyDay('28')).toBe(28)
    expect(() => normalizeMonthlyDay('31')).toThrow('Monthly day must be between 1 and 28.')
    expect(normalizeIntervalMinutes('5')).toBe(5)
    expect(() => normalizeIntervalMinutes('0')).toThrow('Interval must be between 1 and 1440 minutes.')
    expect(normalizeTimezone('Europe/Istanbul')).toBe('Europe/Istanbul')
    expect(() => normalizeTimezone('Mars/Olympus')).toThrow('Invalid timezone.')
  })

  it('runs daily schedules once per local date after configured time', async () => {
    const { getCronDueRunKey } = await import('@/lib/cron-schedule')
    const now = new Date('2026-07-07T05:10:00.000Z') // 08:10 Europe/Istanbul

    const runKey = getCronDueRunKey(
      {
        id: 'calendar-workflow-events',
        enabled: true,
        scheduleType: 'daily',
        dailyTime: '08:00',
        timezone: 'Europe/Istanbul',
      },
      now,
    )

    expect(runKey).toBe('calendar-workflow-events:2026-07-07')
    expect(
      getCronDueRunKey(
        {
          id: 'calendar-workflow-events',
          enabled: true,
          scheduleType: 'daily',
          dailyTime: '08:00',
          timezone: 'Europe/Istanbul',
          lastRunKey: runKey,
        },
        now,
      ),
    ).toBeNull()
  })

  it('runs monthly schedules once per local month after configured day and time', async () => {
    const { getCronDueRunKey } = await import('@/lib/cron-schedule')
    const now = new Date('2026-07-01T05:20:00.000Z') // 08:20 Europe/Istanbul

    expect(
      getCronDueRunKey(
        {
          id: 'payroll-generation',
          enabled: true,
          scheduleType: 'monthly',
          monthlyDay: 1,
          monthlyTime: '08:20',
          timezone: 'Europe/Istanbul',
        },
        now,
      ),
    ).toBe('payroll-generation:2026-07')
  })

  it('runs interval schedules after the configured interval', async () => {
    const { getCronDueRunKey } = await import('@/lib/cron-schedule')
    const now = new Date('2026-07-07T08:20:00.000Z')

    expect(
      getCronDueRunKey(
        {
          id: 'notification-events',
          enabled: true,
          scheduleType: 'interval',
          intervalMinutes: 5,
          timezone: 'Europe/Istanbul',
          lastRunAt: '2026-07-07T08:14:59.000Z',
        },
        now,
      ),
    ).toBe('notification-events:interval:2026-07-07T08:20')

    expect(
      getCronDueRunKey(
        {
          id: 'notification-events',
          enabled: true,
          scheduleType: 'interval',
          intervalMinutes: 5,
          timezone: 'Europe/Istanbul',
          lastRunAt: '2026-07-07T08:16:00.000Z',
        },
        now,
      ),
    ).toBeNull()
  })
})

describe('birthday and anniversary cron events', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('emits workflow events for upcoming work anniversaries after the first completed year', async () => {
    const emitNotificationEvent = vi.fn().mockResolvedValue({ id: 'event-1' })
    const where = vi.fn().mockResolvedValue([
      {
        id: 'user-1',
        fullName: 'Alex Morgan',
        email: 'alex@example.com',
        birthDate: null,
        joinedAt: '2021-07-29T00:00:00.000Z',
      },
      {
        id: 'user-2',
        fullName: 'New Employee',
        email: 'new@example.com',
        birthDate: null,
        joinedAt: '2026-07-29T00:00:00.000Z',
      },
    ])
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))

    vi.doMock('@/db', () => ({ db: { select } }))
    vi.doMock('@/lib/company-settings', () => ({
      getOrCreateCompanySettings: vi.fn().mockResolvedValue({ defaultTimezone: 'UTC' }),
    }))
    vi.doMock('@/lib/notification-events', () => ({ emitNotificationEvent }))

    const { emitCalendarWorkflowEvents } = await import('@/lib/birthday-notifications')
    const result = await emitCalendarWorkflowEvents(new Date('2026-07-24T10:00:00.000Z'))

    expect(result).toMatchObject({
      emitted: 1,
      birthdaysEmitted: 0,
      anniversariesEmitted: 1,
    })
    expect(emitNotificationEvent).toHaveBeenCalledTimes(1)
    expect(emitNotificationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'calendar_item.upcoming',
        sourceType: 'calendar_item',
        sourceId: 'user-1-2026-07-29',
        payload: expect.objectContaining({
          calendarItemType: 'work_anniversary',
          employeeName: 'Alex Morgan',
          date: '2026-07-29',
          daysUntil: '5',
          yearsCompleted: '5',
        }),
      }),
    )
  })
})
