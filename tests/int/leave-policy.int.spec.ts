import { describe, expect, it } from 'vitest'
import {
  countChargeableLeaveDays,
  DEFAULT_LEAVE_ENTITLEMENT_TIERS,
  DEFAULT_LEAVE_POLICY,
  getAnnualEntitlement,
  getAnnualLeaveBalance,
  type LeaveBalanceRecord,
} from '@/lib/leave-policy'
import { parseLeaveFormData } from '@/lib/leave-form-data'

const user = {
  id: 'user-1',
  joinedAt: '2024-01-01',
}

const starterTiers = [
  { minimumServiceMonths: 6, days: 7, label: 'After 6 months', isActive: true },
  { minimumServiceMonths: 12, days: 14, label: 'After 12 months', isActive: true },
]

describe('leave policy calculations', () => {
  it('does not grant annual leave before the first configured tier', () => {
    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2025-06-10' },
        DEFAULT_LEAVE_ENTITLEMENT_TIERS,
        '2026-06-09',
      ),
    ).toBe(0)
  })

  it('grants annual leave from configured active tiers', () => {
    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2020-01-01' },
        DEFAULT_LEAVE_ENTITLEMENT_TIERS,
        '2026-01-01',
      ),
    ).toBe(96)
  })

  it('anchors annual leave entitlement to joinedAt instead of official start date', () => {
    const employee = {
      id: 'user-1',
      joinedAt: '2026-01-01',
      employmentStartDate: '2026-07-01',
    }

    expect(getAnnualEntitlement(employee, starterTiers, '2026-07-01')).toBe(7)
    expect(getAnnualEntitlement(employee, starterTiers, '2026-12-31')).toBe(7)
    expect(getAnnualEntitlement(employee, starterTiers, '2027-01-01')).toBe(21)
  })

  it('grants starter allowance at 6 months', () => {
    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2026-01-01' },
        starterTiers,
        '2026-06-30',
      ),
    ).toBe(0)

    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2026-01-01' },
        starterTiers,
        '2026-07-01',
      ),
    ).toBe(7)
  })

  it('grants the 12-month tier at 12 months after a 6-month starter tier', () => {
    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2026-01-01' },
        starterTiers,
        '2027-01-01',
      ),
    ).toBe(21)

    expect(
      getAnnualEntitlement(
        { id: 'user-1', joinedAt: '2026-01-01' },
        starterTiers,
        '2027-07-01',
      ),
    ).toBe(21)
  })

  it('uses the next grant date as the leave balance period boundary', () => {
    const leaves: LeaveBalanceRecord[] = [
      {
        id: 'starter-period-leave',
        userId: user.id,
        type: 'annual',
        status: 'approved',
        startDate: '2026-08-01',
        totalDays: 3,
      },
      {
        id: 'annual-period-leave',
        userId: user.id,
        type: 'annual',
        status: 'requested',
        startDate: '2027-02-01',
        totalDays: 2,
      },
    ]

    const balance = getAnnualLeaveBalance(
      { id: user.id, joinedAt: '2026-01-01' },
      leaves,
      starterTiers,
      DEFAULT_LEAVE_POLICY,
      '2027-01-01',
    )

    expect(balance).toEqual({
      entitled: 18,
      used: 0,
      pending: 2,
      available: 18,
      projectedRemaining: 16,
    })
  })

  it('carries all unused annual leave forward when carryover limit is blank', () => {
    const leaves: LeaveBalanceRecord[] = [
      {
        id: 'approved',
        userId: user.id,
        type: 'annual',
        status: 'approved',
        startDate: '2025-03-01',
        totalDays: 5,
      },
      {
        id: 'requested',
        userId: user.id,
        type: 'annual',
        status: 'requested',
        startDate: '2026-02-01',
        totalDays: 3,
      },
    ]

    const balance = getAnnualLeaveBalance(
      user,
      leaves,
      DEFAULT_LEAVE_ENTITLEMENT_TIERS,
      DEFAULT_LEAVE_POLICY,
      '2026-01-01',
    )

    expect(balance).toEqual({
      entitled: 23,
      used: 0,
      pending: 3,
      available: 23,
      projectedRemaining: 20,
    })
  })

  it('limits carried leave when carryover limit has a number', () => {
    const leaves: LeaveBalanceRecord[] = [
      {
        id: 'approved',
        userId: user.id,
        type: 'annual',
        status: 'approved',
        startDate: '2025-03-01',
        totalDays: 5,
      },
    ]

    const capped = getAnnualLeaveBalance(
      user,
      leaves,
      DEFAULT_LEAVE_ENTITLEMENT_TIERS,
      { ...DEFAULT_LEAVE_POLICY, carryoverLimitDays: 5 },
      '2026-01-01',
    )
    const none = getAnnualLeaveBalance(
      user,
      leaves,
      DEFAULT_LEAVE_ENTITLEMENT_TIERS,
      { ...DEFAULT_LEAVE_POLICY, carryoverLimitDays: 0 },
      '2026-01-01',
    )

    expect(capped.entitled).toBe(19)
    expect(capped.available).toBe(19)
    expect(none.entitled).toBe(14)
    expect(none.available).toBe(14)
  })

  it('has no annual entitlement when all tiers are deleted', () => {
    const balance = getAnnualLeaveBalance(user, [], [], DEFAULT_LEAVE_POLICY, '2026-01-01')

    expect(balance.entitled).toBe(0)
    expect(balance.available).toBe(0)
  })

  it('ignores rejected, cancelled, and non-annual leave in annual balance', () => {
    const leaves: LeaveBalanceRecord[] = [
      {
        type: 'annual',
        status: 'rejected',
        startDate: '2025-03-01',
        totalDays: 5,
      },
      {
        type: 'annual',
        status: 'cancelled',
        startDate: '2025-04-01',
        totalDays: 4,
      },
      {
        type: 'sick',
        status: 'approved',
        startDate: '2025-05-01',
        totalDays: 2,
      },
    ]

    const balance = getAnnualLeaveBalance(
      user,
      leaves,
      DEFAULT_LEAVE_ENTITLEMENT_TIERS,
      DEFAULT_LEAVE_POLICY,
      '2025-01-01',
    )

    expect(balance.used).toBe(0)
    expect(balance.pending).toBe(0)
    expect(balance.available).toBe(14)
  })

  it('counts Saturday and Sunday according to policy settings', () => {
    expect(countChargeableLeaveDays('2026-06-12', '2026-06-15', DEFAULT_LEAVE_POLICY)).toBe(3)
    expect(countChargeableLeaveDays('2026-06-11', '2026-06-12', DEFAULT_LEAVE_POLICY)).toBe(2)
    expect(
      countChargeableLeaveDays('2026-06-12', '2026-06-15', {
        countSaturday: false,
        countSunday: false,
      }),
    ).toBe(2)
    expect(
      countChargeableLeaveDays('2026-06-12', '2026-06-15', {
        countSaturday: true,
        countSunday: true,
      }),
    ).toBe(4)
  })

  it('counts or excludes selected public holidays according to policy settings', () => {
    const holidayDates = ['2026-01-01']

    expect(
      countChargeableLeaveDays(
        '2026-01-01',
        '2026-01-02',
        { ...DEFAULT_LEAVE_POLICY, countHolidays: true },
        holidayDates,
      ),
    ).toBe(2)

    expect(
      countChargeableLeaveDays(
        '2026-01-01',
        '2026-01-02',
        { ...DEFAULT_LEAVE_POLICY, countHolidays: false },
        holidayDates,
      ),
    ).toBe(1)

    expect(
      countChargeableLeaveDays(
        '2026-01-01',
        '2026-01-02',
        { ...DEFAULT_LEAVE_POLICY, countHolidays: false },
        [],
      ),
    ).toBe(2)
  })

  it('applies holiday and weekend settings independently', () => {
    expect(
      countChargeableLeaveDays(
        '2026-06-12',
        '2026-06-15',
        {
          countSaturday: false,
          countSunday: false,
          countHolidays: false,
        },
        ['2026-06-15'],
      ),
    ).toBe(1)
  })

  it('uses manual charged-day override and requires a reason', () => {
    const formData = new FormData()
    formData.set('user', user.id)
    formData.set('type', 'annual')
    formData.set('startDate', '2026-06-12')
    formData.set('endDate', '2026-06-15')
    formData.set('status', 'requested')
    formData.set('reason', 'Vacation')
    formData.set('isManualDayCount', 'true')
    formData.set('totalDays', '2')
    formData.set('manualDayCountReason', 'Manager adjustment')

    const parsed = parseLeaveFormData(formData, {
      policy: DEFAULT_LEAVE_POLICY,
      holidayDates: ['2026-06-12'],
      canOverrideDays: true,
    })

    expect(parsed.autoCalculatedDays).toBe(3)
    expect(parsed.totalDays).toBe(2)
    expect(parsed.isManualDayCount).toBe(true)
    expect(parsed.manualDayCountReason).toBe('Manager adjustment')

    formData.set('manualDayCountReason', '')
    expect(() =>
      parseLeaveFormData(formData, {
        policy: DEFAULT_LEAVE_POLICY,
        canOverrideDays: true,
      }),
    ).toThrow('Manual charged-day override requires a reason')
  })

  it('keeps totalDays as the charged value when no override is allowed', () => {
    const formData = new FormData()
    formData.set('user', user.id)
    formData.set('type', 'annual')
    formData.set('startDate', '2026-06-12')
    formData.set('endDate', '2026-06-15')
    formData.set('status', 'requested')
    formData.set('reason', 'Vacation')
    formData.set('isManualDayCount', 'true')
    formData.set('totalDays', '2')
    formData.set('manualDayCountReason', 'Ignored')

    const parsed = parseLeaveFormData(formData, {
      policy: DEFAULT_LEAVE_POLICY,
      canOverrideDays: false,
    })

    expect(parsed.autoCalculatedDays).toBe(3)
    expect(parsed.totalDays).toBe(3)
    expect(parsed.isManualDayCount).toBe(false)
    expect(parsed.manualDayCountReason).toBeNull()
  })
})
