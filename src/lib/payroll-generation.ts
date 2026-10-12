import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { leavesTable, payrollSettingsTable, payrollTable, usersTable } from '@/db/schema'
import { getCompanyHolidayDatesForLeaveRange } from '@/lib/company-holidays'
import { getLeavePolicyConfig } from '@/lib/leave-policy-db'
import {
  countChargeableLeaveDays,
  type LeavePolicySettings,
  type LeaveBalanceRecord,
} from '@/lib/leave-policy'
import { activeEmployeeWhere } from '@/lib/people'
import { writeMemberActivityLog } from '@/lib/member-activity'
import {
  emitNotificationEvent,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'

export type PayrollMonth =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'

export type GeneratePayrollsForPeriodInput = {
  month: PayrollMonth
  year: number
  scopedUserIds?: string[] | null
  actorUserId?: string | null
}

export type GeneratePayrollsForPeriodResult = {
  month: PayrollMonth
  year: number
  checkedEmployees: number
  generated: number
  skippedExisting: number
  skippedNoDueSettings: number
  payrollIds: string[]
}

type UnpaidLeaveDeductionInput = {
  grossAmount: number
  periodStart: string
  periodEnd: string
  policy: Pick<
    LeavePolicySettings,
    | 'countSaturday'
    | 'countSunday'
    | 'countHolidays'
    | 'unpaidLeaveDeductionEnabled'
    | 'unpaidLeaveDeductionDailyRateBasis'
    | 'unpaidLeaveDeductionDayBasis'
  >
  holidayDates?: Iterable<string>
  leaves: LeaveBalanceRecord[]
}

export function formatDateForDb(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function formatMoney(value: number) {
  return toMoney(value).toFixed(2)
}

export function toPayrollMonth(value: string | number): PayrollMonth {
  const month = String(value).padStart(2, '0')
  if (
    month !== '01' &&
    month !== '02' &&
    month !== '03' &&
    month !== '04' &&
    month !== '05' &&
    month !== '06' &&
    month !== '07' &&
    month !== '08' &&
    month !== '09' &&
    month !== '10' &&
    month !== '11' &&
    month !== '12'
  ) {
    throw new Error('Invalid payroll month.')
  }

  return month
}

export function isSettingDueForPeriod(
  setting: typeof payrollSettingsTable.$inferSelect,
  month: string,
  year: number,
) {
  if (setting.paymentFrequency === 'monthly') {
    return true
  }

  if (setting.paymentFrequency !== 'quarterly' && setting.paymentFrequency !== 'annual') {
    return false
  }

  const startDate = new Date(setting.startDate)
  if (Number.isNaN(startDate.getTime())) {
    return false
  }

  const monthsSinceStart =
    (year - startDate.getFullYear()) * 12 + (Number(month) - 1 - startDate.getMonth())

  if (monthsSinceStart < 0) {
    return false
  }

  return setting.paymentFrequency === 'quarterly'
    ? monthsSinceStart % 3 === 0
    : monthsSinceStart % 12 === 0
}

export function isPayrollSettingActiveInPeriod(
  setting: Pick<typeof payrollSettingsTable.$inferSelect, 'startDate' | 'endDate'>,
  periodStart: string,
  periodEnd: string,
) {
  return setting.startDate <= periodEnd && (!setting.endDate || setting.endDate >= periodStart)
}

export function getWorkingDaysForPayrollMonth(
  periodStart: string,
  periodEnd: string,
  policy: Pick<LeavePolicySettings, 'countSaturday' | 'countSunday' | 'countHolidays'>,
  holidayDates: Iterable<string> = [],
) {
  return countChargeableLeaveDays(periodStart, periodEnd, policy, holidayDates)
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function countCalendarDaysInRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (!start || !end || end < start) return 0

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function getPayrollDailyRateDivisor({
  periodStart,
  periodEnd,
  policy,
  holidayDates = [],
}: Pick<UnpaidLeaveDeductionInput, 'periodStart' | 'periodEnd' | 'policy' | 'holidayDates'>) {
  if (policy.unpaidLeaveDeductionDailyRateBasis === 'fixed30') {
    return 30
  }

  if (policy.unpaidLeaveDeductionDailyRateBasis === 'calendarDays') {
    return countCalendarDaysInRange(periodStart, periodEnd)
  }

  return getWorkingDaysForPayrollMonth(periodStart, periodEnd, policy, holidayDates)
}

export function calculateUnpaidLeaveDaysForPayrollMonth({
  periodStart,
  periodEnd,
  policy,
  holidayDates = [],
  leaves,
}: Omit<UnpaidLeaveDeductionInput, 'grossAmount'>) {
  return leaves
    .filter((leave) => leave.type === 'unpaid' && leave.status === 'approved')
    .reduce((total, leave) => {
      const leaveEndDate = leave.endDate || leave.startDate
      const overlapStart = leave.startDate > periodStart ? leave.startDate : periodStart
      const overlapEnd = leaveEndDate < periodEnd ? leaveEndDate : periodEnd

      if (overlapEnd < overlapStart) return total

      if (policy.unpaidLeaveDeductionDayBasis === 'calendarDays') {
        return total + countCalendarDaysInRange(overlapStart, overlapEnd)
      }

      return total + countChargeableLeaveDays(overlapStart, overlapEnd, policy, holidayDates)
    }, 0)
}

export function calculateUnpaidLeaveDeduction(input: UnpaidLeaveDeductionInput) {
  if (!input.policy.unpaidLeaveDeductionEnabled) {
    return {
      divisorDays: 0,
      workingDays: 0,
      unpaidDays: 0,
      dailyRate: 0,
      deductionAmount: 0,
      adjustmentNote: null,
    }
  }

  const divisorDays = getPayrollDailyRateDivisor(input)
  const unpaidDays = calculateUnpaidLeaveDaysForPayrollMonth(input)
  const dailyRate = toMoney(divisorDays > 0 ? input.grossAmount / divisorDays : 0)
  const deductionAmount = toMoney(unpaidDays * dailyRate)

  return {
    divisorDays,
    workingDays: divisorDays,
    unpaidDays,
    dailyRate,
    deductionAmount,
    adjustmentNote:
      deductionAmount > 0
        ? `Unpaid leave deduction: ${unpaidDays} day${unpaidDays === 1 ? '' : 's'} x ${formatMoney(
            dailyRate,
          )} = ${formatMoney(deductionAmount)}`
        : null,
  }
}

export async function generatePayrollsForPeriod({
  month,
  year,
  scopedUserIds,
  actorUserId = null,
}: GeneratePayrollsForPeriodInput): Promise<GeneratePayrollsForPeriodResult> {
  const periodStart = formatDateForDb(new Date(year, Number(month) - 1, 1))
  const periodEnd = formatDateForDb(new Date(year, Number(month), 0))

  if (scopedUserIds && scopedUserIds.length === 0) {
    return {
      month,
      year,
      checkedEmployees: 0,
      generated: 0,
      skippedExisting: 0,
      skippedNoDueSettings: 0,
      payrollIds: [],
    }
  }

  const employees = await db.query.usersTable.findMany({
    where: scopedUserIds ? inArray(usersTable.id, scopedUserIds) : activeEmployeeWhere(),
  })

  const result: GeneratePayrollsForPeriodResult = {
    month,
    year,
    checkedEmployees: employees.length,
    generated: 0,
    skippedExisting: 0,
    skippedNoDueSettings: 0,
    payrollIds: [],
  }
  const { policy } = await getLeavePolicyConfig()
  const holidayDates = await getCompanyHolidayDatesForLeaveRange(periodStart, periodEnd)

  for (const employee of employees) {
    const payrollSettings = await db.query.payrollSettingsTable.findMany({
      where: and(
        eq(payrollSettingsTable.employeeId, employee.id),
        eq(payrollSettingsTable.isActive, true),
        lte(payrollSettingsTable.startDate, periodEnd),
        or(isNull(payrollSettingsTable.endDate), gte(payrollSettingsTable.endDate, periodStart)),
      ),
    })

    const dueSettings = payrollSettings.filter(
      (setting) =>
        isPayrollSettingActiveInPeriod(setting, periodStart, periodEnd) &&
        isSettingDueForPeriod(setting, month, year),
    )

    if (dueSettings.length === 0) {
      result.skippedNoDueSettings += 1
      continue
    }

    const existing = await db.query.payrollTable.findFirst({
      where: and(
        eq(payrollTable.employeeId, employee.id),
        eq(payrollTable.month, month),
        eq(payrollTable.year, year),
      ),
    })

    if (existing) {
      result.skippedExisting += 1
      continue
    }

    const payrollItems = dueSettings.map((setting) => {
      const amount =
        typeof setting.amount === 'string' ? parseFloat(setting.amount) : setting.amount

      return {
        payrollSettingId: setting.id,
        description: setting.description || 'Recurring salary',
        payrollType: 'primary' as const,
        amount: amount || 0,
        paymentType: setting.paymentType,
      }
    })

    const totalAmount = payrollItems.reduce((sum, item) => sum + item.amount, 0)
    const unpaidLeaves = await db.query.leavesTable.findMany({
      where: and(
        eq(leavesTable.userId, employee.id),
        eq(leavesTable.type, 'unpaid'),
        eq(leavesTable.status, 'approved'),
        lte(leavesTable.startDate, periodEnd),
        gte(leavesTable.endDate, periodStart),
      ),
    })
    const unpaidDeduction = calculateUnpaidLeaveDeduction({
      grossAmount: totalAmount,
      periodStart,
      periodEnd,
      policy,
      holidayDates,
      leaves: unpaidLeaves,
    })
    const deductionAmount = unpaidDeduction.deductionAmount
    const netTotalAmount = toMoney(totalAmount - deductionAmount)

    const [created] = await db
      .insert(payrollTable)
      .values({
        employeeId: employee.id,
        month,
        year,
        payrollItems,
        bonusAmount: '0',
        deductionAmount: formatMoney(deductionAmount),
        adjustmentNote: unpaidDeduction.adjustmentNote,
        totalAmount: formatMoney(netTotalAmount),
        status: 'generated',
      })
      .returning()

    if (created) {
      await writeMemberActivityLog({
        subjectUserId: created.employeeId,
        actorUserId,
        eventType: 'payroll.generated',
        sourceType: 'payroll',
        sourceId: created.id,
        sourceLabel: `${created.month}/${created.year} payroll`,
        sourceKey: `payroll.generated:${created.id}`,
        metadata: {
          month: created.month,
          year: created.year,
          totalAmount: created.totalAmount,
          status: created.status,
          linkUrl: '/payroll',
        },
        createdAt: created.createdAt,
      })
      await emitNotificationEvent({
        eventType: NOTIFICATION_EVENTS.payrollGenerated,
        sourceType: 'payroll',
        sourceId: created.id,
        sourceKey: `${NOTIFICATION_EVENTS.payrollGenerated}:payroll:${created.id}`,
        actorUserId,
        recipients: toNotificationRecipients([employee]),
        payload: {
          payrollId: created.id,
          subjectUserId: created.employeeId,
          employeeId: created.employeeId,
          employeeName: employee.fullName || 'Employee',
          departmentId: employee.departmentId || '',
          month: created.month,
          year: created.year,
          totalAmount: created.totalAmount,
          status: created.status,
          linkUrl: '/payroll',
        },
        processImmediately: false,
      })
      result.generated += 1
      result.payrollIds.push(created.id)
    }
  }

  return result
}
