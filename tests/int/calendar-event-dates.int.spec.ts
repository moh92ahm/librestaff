import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCalendarDisplayEnd, normalizeCalendarEventDateRange } from '@/lib/calendar-event-dates'
import {
  transformBirthdaysToEvents,
  transformWorkAnniversariesToEvents,
} from '@/lib/calendar-utils'

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe('calendar event date helpers', () => {
  it('uses date-only all-day boundaries for display normalization', () => {
    const event = normalizeCalendarEventDateRange({
      start: new Date('2026-05-27T00:00:00.000Z'),
      end: new Date('2026-06-01T00:00:00.000Z'),
      startDate: '2026-05-27',
      endDate: '2026-06-01',
      allDay: true,
    })

    expect(formatLocalDate(event.start)).toBe('2026-05-27')
    expect(formatLocalDate(event.end)).toBe('2026-06-01')
    expect(formatLocalDate(getCalendarDisplayEnd(event))).toBe('2026-05-31')
  })

  it('keeps server-created birthdays on one local calendar day', () => {
    const currentYear = new Date().getFullYear()
    const birthday = transformBirthdaysToEvents([
      {
        id: 'birthday-user',
        fullName: 'Taylor Reed',
        email: 'taylor@example.com',
        birthDate: '1990-07-04',
      },
    ] as any).find((event) => event.id === `birthday-user-${currentYear}`)

    expect(birthday).toMatchObject({
      startDate: `${currentYear}-07-04`,
      endDate: `${currentYear}-07-05`,
      allDay: true,
    })

    const browserEvent = normalizeCalendarEventDateRange({
      ...birthday!,
      start: birthday!.start.toISOString(),
      end: birthday!.end.toISOString(),
    })

    expect(formatLocalDate(browserEvent.start)).toBe(`${currentYear}-07-04`)
    expect(formatLocalDate(getCalendarDisplayEnd(browserEvent))).toBe(`${currentYear}-07-04`)
  })

  it('creates work anniversary events after the first completed year', () => {
    const currentYear = new Date().getFullYear()

    const events = transformWorkAnniversariesToEvents([
      {
        id: 'user-1',
        fullName: 'Alex Morgan',
        email: 'alex@example.com',
        roleId: null,
        departmentId: null,
        birthDate: null,
        phone: null,
        jobTitle: null,
        joinedAt: `${currentYear - 1}-07-01T00:00:00.000Z`,
        isActive: true,
      },
      {
        id: 'user-2',
        fullName: 'New Employee',
        email: 'new@example.com',
        roleId: null,
        departmentId: null,
        birthDate: null,
        phone: null,
        jobTitle: null,
        joinedAt: `${currentYear}-07-01T00:00:00.000Z`,
        isActive: true,
      },
    ] as any)

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `work-anniversary-user-1-${currentYear}`,
          title: '🎉 Alex Morgan (1 year)',
          type: 'anniversary',
          startDate: `${currentYear}-07-01`,
          endDate: `${currentYear}-07-02`,
        }),
      ]),
    )
    expect(events.map((event) => event.id)).not.toContain(`work-anniversary-user-2-${currentYear}`)
  })

  it('does not create birthday or anniversary events for inactive employees', () => {
    const currentYear = new Date().getFullYear()
    const inactiveUser = {
      id: 'inactive-user',
      fullName: 'Inactive Employee',
      email: 'inactive@example.com',
      birthDate: '1990-07-04',
      joinedAt: `${currentYear - 3}-07-01T00:00:00.000Z`,
      isActive: false,
    }

    expect(transformBirthdaysToEvents([inactiveUser] as any)).toEqual([])
    expect(transformWorkAnniversariesToEvents([inactiveUser] as any)).toEqual([])
  })
})

describe('approved leave calendar events', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  function mockApprovedLeaves(rows: unknown[]) {
    const orderBy = vi.fn().mockResolvedValue(rows)
    const where = vi.fn(() => ({ orderBy }))
    const leftJoin = vi.fn(() => ({ where }))
    const innerJoin = vi.fn(() => ({ leftJoin }))
    const from = vi.fn(() => ({ innerJoin }))
    const select = vi.fn(() => ({ from }))

    vi.doMock('@/db', () => ({
      db: { select },
    }))
  }

  it('shows approved leaves to admins, the employee, and that employee manager only', async () => {
    mockApprovedLeaves([
      {
        id: 'leave-1',
        userId: 'employee-1',
        type: 'annual',
        startDate: '2026-08-03',
        endDate: '2026-08-05',
        totalDays: 3,
        employeeName: 'Alex Morgan',
        departmentManagerUserId: 'manager-1',
      },
      {
        id: 'leave-2',
        userId: 'employee-2',
        type: 'sick',
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        totalDays: 1,
        employeeName: 'Sam Wilson',
        departmentManagerUserId: 'manager-2',
      },
    ])

    const { getVisibleApprovedLeaveCalendarEvents } = await import('@/lib/events')

    const adminEvents = await getVisibleApprovedLeaveCalendarEvents({
      id: 'admin-1',
      role: { id: 'role-admin', name: 'admin', displayName: 'Admin' },
    })
    const employeeEvents = await getVisibleApprovedLeaveCalendarEvents({
      id: 'employee-1',
      role: { id: 'role-member', name: 'member', displayName: 'Member' },
    })
    const managerEvents = await getVisibleApprovedLeaveCalendarEvents({
      id: 'manager-1',
      role: { id: 'role-member', name: 'member', displayName: 'Member' },
    })

    expect(adminEvents.map((event) => event.id)).toEqual(['leave-leave-1', 'leave-leave-2'])
    expect(employeeEvents.map((event) => event.id)).toEqual(['leave-leave-1'])
    expect(managerEvents.map((event) => event.id)).toEqual(['leave-leave-1'])
    expect(employeeEvents[0]).toMatchObject({
      title: 'Alex Morgan - annual leave',
      type: 'leave',
      allDay: true,
      startDate: '2026-08-03',
      endDate: '2026-08-06',
      linkUrl: '/me?tab=leaves',
    })
    expect(managerEvents[0]?.linkUrl).toBe('/leaves')
  })
})
