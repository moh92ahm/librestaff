import { describe, expect, it } from 'vitest'

const baseUnpaidDeductionPolicy = {
  countSaturday: false,
  countSunday: false,
  countHolidays: false,
  unpaidLeaveDeductionEnabled: true,
  unpaidLeaveDeductionDailyRateBasis: 'workingDays' as const,
  unpaidLeaveDeductionDayBasis: 'leavePolicy' as const,
}

describe('payroll generation helpers', () => {
  it('normalizes valid payroll months and rejects invalid months', async () => {
    const { toPayrollMonth } = await import('@/lib/payroll-generation')

    expect(toPayrollMonth(1)).toBe('01')
    expect(toPayrollMonth('06')).toBe('06')
    expect(() => toPayrollMonth('13')).toThrow('Invalid payroll month.')
  })

  it('detects monthly, quarterly, and annual due settings by period', async () => {
    const { isSettingDueForPeriod } = await import('@/lib/payroll-generation')
    const baseSetting = {
      startDate: '2026-01-01',
      paymentFrequency: 'monthly',
    } as Parameters<typeof isSettingDueForPeriod>[0]

    expect(isSettingDueForPeriod(baseSetting, '06', 2026)).toBe(true)
    expect(
      isSettingDueForPeriod({ ...baseSetting, paymentFrequency: 'quarterly' }, '04', 2026),
    ).toBe(true)
    expect(
      isSettingDueForPeriod({ ...baseSetting, paymentFrequency: 'quarterly' }, '05', 2026),
    ).toBe(false)
    expect(
      isSettingDueForPeriod({ ...baseSetting, paymentFrequency: 'annual' }, '01', 2027),
    ).toBe(true)
  })

  it('detects payroll setting active windows by payroll period', async () => {
    const { isPayrollSettingActiveInPeriod } = await import('@/lib/payroll-generation')
    const periodStart = '2026-06-01'
    const periodEnd = '2026-06-30'

    expect(
      isPayrollSettingActiveInPeriod(
        { startDate: '2026-07-01', endDate: null },
        periodStart,
        periodEnd,
      ),
    ).toBe(false)
    expect(
      isPayrollSettingActiveInPeriod(
        { startDate: '2026-01-01', endDate: '2026-05-31' },
        periodStart,
        periodEnd,
      ),
    ).toBe(false)
    expect(
      isPayrollSettingActiveInPeriod(
        { startDate: '2026-06-30', endDate: null },
        periodStart,
        periodEnd,
      ),
    ).toBe(true)
    expect(
      isPayrollSettingActiveInPeriod(
        { startDate: '2026-01-01', endDate: '2026-06-01' },
        periodStart,
        periodEnd,
      ),
    ).toBe(true)
  })

  it('keeps quarterly and annual payment schedules anchored to the setting start date', async () => {
    const { isPayrollSettingActiveInPeriod, isSettingDueForPeriod } = await import(
      '@/lib/payroll-generation'
    )
    const quarterlySetting = {
      startDate: '2026-02-15',
      endDate: null,
      paymentFrequency: 'quarterly',
    } as Parameters<typeof isSettingDueForPeriod>[0]
    const annualSetting = {
      ...quarterlySetting,
      paymentFrequency: 'annual',
    } as Parameters<typeof isSettingDueForPeriod>[0]

    expect(isPayrollSettingActiveInPeriod(quarterlySetting, '2026-05-01', '2026-05-31')).toBe(true)
    expect(isSettingDueForPeriod(quarterlySetting, '05', 2026)).toBe(true)
    expect(isSettingDueForPeriod(quarterlySetting, '06', 2026)).toBe(false)
    expect(isSettingDueForPeriod(annualSetting, '02', 2027)).toBe(true)
    expect(isSettingDueForPeriod(annualSetting, '01', 2027)).toBe(false)
  })

  it('calculates unpaid leave deductions from approved unpaid leave only', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 22000,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: baseUnpaidDeductionPolicy,
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-08',
          totalDays: 1,
        },
        {
          type: 'unpaid',
          status: 'requested',
          startDate: '2026-06-09',
          totalDays: 1,
        },
        {
          type: 'annual',
          status: 'approved',
          startDate: '2026-06-10',
          totalDays: 1,
        },
      ].map((leave) => ({ ...leave, endDate: leave.startDate })),
    })

    expect(deduction.workingDays).toBe(22)
    expect(deduction.unpaidDays).toBe(1)
    expect(deduction.dailyRate).toBe(1000)
    expect(deduction.deductionAmount).toBe(1000)
    expect(deduction.adjustmentNote).toBe('Unpaid leave deduction: 1 day x 1000.00 = 1000.00')
  })

  it('splits cross-month unpaid leave into the target payroll month', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 22000,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: baseUnpaidDeductionPolicy,
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-29',
          endDate: '2026-07-03',
          totalDays: 5,
        },
      ],
    })

    expect(deduction.unpaidDays).toBe(2)
    expect(deduction.deductionAmount).toBe(2000)
  })

  it('applies weekend and holiday policy to unpaid leave deduction days', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 21000,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: baseUnpaidDeductionPolicy,
      holidayDates: ['2026-06-12'],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-12',
          endDate: '2026-06-15',
          totalDays: 4,
        },
      ],
    })

    expect(deduction.workingDays).toBe(21)
    expect(deduction.unpaidDays).toBe(1)
    expect(deduction.deductionAmount).toBe(1000)
  })

  it('preserves current working-day basis when Saturdays are charged', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 6500,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: {
        ...baseUnpaidDeductionPolicy,
        countSaturday: true,
      },
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-11',
          endDate: '2026-06-15',
          totalDays: 5,
        },
      ],
    })

    expect(deduction.divisorDays).toBe(26)
    expect(deduction.unpaidDays).toBe(4)
    expect(deduction.dailyRate).toBe(250)
    expect(deduction.deductionAmount).toBe(1000)
  })

  it('uses fixed 30 days for the daily rate when configured', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 6500,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: {
        ...baseUnpaidDeductionPolicy,
        countSaturday: true,
        unpaidLeaveDeductionDailyRateBasis: 'fixed30',
      },
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-11',
          endDate: '2026-06-15',
          totalDays: 5,
        },
      ],
    })

    expect(deduction.divisorDays).toBe(30)
    expect(deduction.unpaidDays).toBe(4)
    expect(deduction.dailyRate).toBe(216.67)
    expect(deduction.deductionAmount).toBe(866.68)
  })

  it('uses calendar days in the month for the daily rate when configured', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 6200,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      policy: {
        ...baseUnpaidDeductionPolicy,
        unpaidLeaveDeductionDailyRateBasis: 'calendarDays',
      },
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-07-06',
          endDate: '2026-07-07',
          totalDays: 2,
        },
      ],
    })

    expect(deduction.divisorDays).toBe(31)
    expect(deduction.unpaidDays).toBe(2)
    expect(deduction.dailyRate).toBe(200)
    expect(deduction.deductionAmount).toBe(400)
  })

  it('counts every unpaid calendar day when configured', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 6500,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: {
        ...baseUnpaidDeductionPolicy,
        countSaturday: true,
        unpaidLeaveDeductionDayBasis: 'calendarDays',
      },
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-11',
          endDate: '2026-06-15',
          totalDays: 5,
        },
      ],
    })

    expect(deduction.divisorDays).toBe(26)
    expect(deduction.unpaidDays).toBe(5)
    expect(deduction.deductionAmount).toBe(1250)
  })

  it('returns no automatic deduction when unpaid leave deduction is disabled', async () => {
    const { calculateUnpaidLeaveDeduction } = await import('@/lib/payroll-generation')

    const deduction = calculateUnpaidLeaveDeduction({
      grossAmount: 6500,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      policy: {
        ...baseUnpaidDeductionPolicy,
        unpaidLeaveDeductionEnabled: false,
      },
      holidayDates: [],
      leaves: [
        {
          type: 'unpaid',
          status: 'approved',
          startDate: '2026-06-11',
          endDate: '2026-06-15',
          totalDays: 5,
        },
      ],
    })

    expect(deduction.divisorDays).toBe(0)
    expect(deduction.unpaidDays).toBe(0)
    expect(deduction.deductionAmount).toBe(0)
    expect(deduction.adjustmentNote).toBeNull()
  })
})
