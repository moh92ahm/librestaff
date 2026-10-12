export type LeavePolicySettings = {
  carryoverLimitDays: number | null
  countSaturday: boolean
  countSunday: boolean
  countHolidays: boolean
  allowNegativeBalance: boolean
  unpaidLeaveDeductionEnabled: boolean
  unpaidLeaveDeductionDailyRateBasis: 'workingDays' | 'fixed30' | 'calendarDays'
  unpaidLeaveDeductionDayBasis: 'leavePolicy' | 'calendarDays'
}

export type LeaveEntitlementTier = {
  minimumServiceMonths: number
  days: number
  label?: string | null
  isActive?: boolean
}

export type LeaveBalanceUser = {
  id: string
  joinedAt?: string | null
}

export type LeaveBalanceRecord = {
  id?: string
  userId?: string | null
  type: string
  status: string
  startDate: string
  endDate?: string
  totalDays?: number | null
}

export type AnnualLeaveBalance = {
  entitled: number
  used: number
  pending: number
  available: number
  projectedRemaining: number
}

export const DEFAULT_LEAVE_POLICY: LeavePolicySettings = {
  carryoverLimitDays: null,
  countSaturday: true,
  countSunday: false,
  countHolidays: true,
  allowNegativeBalance: true,
  unpaidLeaveDeductionEnabled: true,
  unpaidLeaveDeductionDailyRateBasis: 'workingDays',
  unpaidLeaveDeductionDayBasis: 'leavePolicy',
}

export const DEFAULT_LEAVE_ENTITLEMENT_TIERS: LeaveEntitlementTier[] = [
  { minimumServiceMonths: 12, days: 14, label: 'After 12 months', isActive: true },
  { minimumServiceMonths: 60, days: 20, label: 'After 60 months', isActive: true },
  { minimumServiceMonths: 180, days: 26, label: 'After 180 months', isActive: true },
]

function parseDateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

function toLocalDate(value: string) {
  const parts = parseDateParts(value)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day)
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addMonths(value: string, months: number) {
  const date = toLocalDate(value)
  if (!date) return null
  const day = date.getDate()
  date.setMonth(date.getMonth() + months)

  if (date.getDate() !== day) {
    date.setDate(0)
  }

  return formatDate(date)
}

function getFullServiceMonths(joinedAt: string, asOfDate: string) {
  const joined = parseDateParts(joinedAt)
  const asOf = parseDateParts(asOfDate)

  if (!joined || !asOf) return 0

  let months = (asOf.year - joined.year) * 12 + (asOf.month - joined.month)

  if (asOf.day < joined.day) {
    months -= 1
  }

  return Math.max(0, months)
}

function getActiveTiers(tiers: LeaveEntitlementTier[]) {
  return tiers
    .filter((tier) => tier.isActive !== false)
    .slice()
    .sort((a, b) => a.minimumServiceMonths - b.minimumServiceMonths)
}

function getTierDaysForServiceMonths(tiers: LeaveEntitlementTier[], serviceMonths: number) {
  const active = getActiveTiers(tiers)
  let selectedDays = 0

  for (const tier of active) {
    if (tier.minimumServiceMonths <= serviceMonths) {
      selectedDays = tier.days
    }
  }

  return selectedDays
}

function getGrantServiceMonthsForCompletedMonths(
  tiers: LeaveEntitlementTier[],
  completedMonths: number,
) {
  const active = getActiveTiers(tiers)
  const firstGrantServiceMonths = active[0]?.minimumServiceMonths ?? null
  if (firstGrantServiceMonths === null || completedMonths < firstGrantServiceMonths) return []

  const grantMonths = new Set<number>()

  for (const tier of active) {
    if (tier.minimumServiceMonths <= completedMonths) {
      grantMonths.add(tier.minimumServiceMonths)
    }
  }

  const firstAnnualGrant =
    firstGrantServiceMonths === 0 ? 0 : Math.ceil(firstGrantServiceMonths / 12) * 12

  for (let serviceMonths = firstAnnualGrant; serviceMonths <= completedMonths; serviceMonths += 12) {
    grantMonths.add(serviceMonths)
  }

  return Array.from(grantMonths).sort((a, b) => a - b)
}

function getGrantServiceMonthsThrough(
  user: LeaveBalanceUser,
  tiers: LeaveEntitlementTier[],
  asOfDate: string,
) {
  if (!user.joinedAt) return []

  const completedMonths = getFullServiceMonths(user.joinedAt.slice(0, 10), asOfDate)
  return getGrantServiceMonthsForCompletedMonths(tiers, completedMonths)
}

function normalizeAsOfDate(asOfDate: string | Date = new Date()) {
  if (typeof asOfDate === 'string') {
    return asOfDate.slice(0, 10)
  }

  return formatDate(asOfDate)
}

export function countChargeableLeaveDays(
  startDate: string,
  endDate: string,
  policy: Partial<Pick<LeavePolicySettings, 'countSaturday' | 'countSunday' | 'countHolidays'>> =
    DEFAULT_LEAVE_POLICY,
  holidayDates: Iterable<string> = [],
) {
  const start = toLocalDate(startDate)
  const end = toLocalDate(endDate)
  const holidayDateSet = new Set(holidayDates)
  const normalizedPolicy = {
    countSaturday: DEFAULT_LEAVE_POLICY.countSaturday,
    countSunday: DEFAULT_LEAVE_POLICY.countSunday,
    countHolidays: DEFAULT_LEAVE_POLICY.countHolidays,
    ...policy,
  }

  if (!start || !end || end < start) {
    return 0
  }

  let total = 0
  const current = new Date(start)

  while (current <= end) {
    const day = current.getDay()
    const isSunday = day === 0
    const isSaturday = day === 6
    const isHoliday = holidayDateSet.has(formatDate(current))

    if (
      (!isSaturday || normalizedPolicy.countSaturday) &&
      (!isSunday || normalizedPolicy.countSunday) &&
      (normalizedPolicy.countHolidays || !isHoliday)
    ) {
      total += 1
    }

    current.setDate(current.getDate() + 1)
  }

  return total
}

export function getAnnualEntitlement(
  user: LeaveBalanceUser,
  tiers: LeaveEntitlementTier[],
  asOfDate: string | Date = new Date(),
) {
  const asOf = normalizeAsOfDate(asOfDate)
  return getGrantServiceMonthsThrough(user, tiers, asOf).reduce(
    (total, serviceMonths) => total + getTierDaysForServiceMonths(tiers, serviceMonths),
    0,
  )
}

function applyCarryoverLimit(remainingDays: number, limit: number | null) {
  const remaining = Math.max(0, remainingDays)

  if (limit === null) {
    return remaining
  }

  return Math.min(remaining, Math.max(0, limit))
}

export function getAnnualLeaveBalance(
  user: LeaveBalanceUser,
  leaves: LeaveBalanceRecord[],
  tiers: LeaveEntitlementTier[],
  policy: LeavePolicySettings = DEFAULT_LEAVE_POLICY,
  asOfDate: string | Date = new Date(),
): AnnualLeaveBalance {
  const asOf = normalizeAsOfDate(asOfDate)
  const grantServiceMonths = getGrantServiceMonthsThrough(user, tiers, asOf)
  const annualLeaves = leaves.filter((leave) => leave.type === 'annual')

  if (!user.joinedAt || grantServiceMonths.length === 0) {
    return {
      entitled: 0,
      used: 0,
      pending: 0,
      available: 0,
      projectedRemaining: 0,
    }
  }

  let carriedDays = 0
  let currentEntitled = 0
  let currentUsed = 0
  let currentPending = 0

  grantServiceMonths.forEach((serviceMonths, index) => {
    const nextGrantServiceMonths = grantServiceMonths[index + 1] ?? serviceMonths + 12
    const periodStart = addMonths(user.joinedAt!.slice(0, 10), serviceMonths)
    const periodEnd = addMonths(user.joinedAt!.slice(0, 10), nextGrantServiceMonths)

    if (!periodStart || !periodEnd) return

    const periodLeaves = annualLeaves.filter(
      (leave) => leave.startDate >= periodStart && leave.startDate < periodEnd,
    )
    const allowance = getTierDaysForServiceMonths(tiers, serviceMonths)
    const entitled = allowance + carriedDays
    const used = periodLeaves
      .filter((leave) => leave.status === 'approved')
      .reduce((sum, leave) => sum + (leave.totalDays || 0), 0)
    const pending = periodLeaves
      .filter((leave) => leave.status === 'requested')
      .reduce((sum, leave) => sum + (leave.totalDays || 0), 0)

    currentEntitled = entitled
    currentUsed = used
    currentPending = pending

    carriedDays = applyCarryoverLimit(entitled - used, policy.carryoverLimitDays)
  })

  const available = currentEntitled - currentUsed

  return {
    entitled: currentEntitled,
    used: currentUsed,
    pending: currentPending,
    available,
    projectedRemaining: available - currentPending,
  }
}

type RawLeavePolicySettings = Partial<
  Omit<
    LeavePolicySettings,
    'unpaidLeaveDeductionDailyRateBasis' | 'unpaidLeaveDeductionDayBasis'
  >
> & {
  unpaidLeaveDeductionDailyRateBasis?: string | null
  unpaidLeaveDeductionDayBasis?: string | null
}

export function normalizeLeavePolicy(policy?: RawLeavePolicySettings | null): LeavePolicySettings {
  const carryoverLimitDays =
    policy?.carryoverLimitDays === undefined || policy.carryoverLimitDays === null
      ? null
      : Math.max(0, policy.carryoverLimitDays)

  const unpaidLeaveDeductionDailyRateBasis =
    policy?.unpaidLeaveDeductionDailyRateBasis === 'fixed30' ||
    policy?.unpaidLeaveDeductionDailyRateBasis === 'calendarDays'
      ? policy.unpaidLeaveDeductionDailyRateBasis
      : DEFAULT_LEAVE_POLICY.unpaidLeaveDeductionDailyRateBasis
  const unpaidLeaveDeductionDayBasis =
    policy?.unpaidLeaveDeductionDayBasis === 'calendarDays'
      ? policy.unpaidLeaveDeductionDayBasis
      : DEFAULT_LEAVE_POLICY.unpaidLeaveDeductionDayBasis

  return {
    ...DEFAULT_LEAVE_POLICY,
    ...policy,
    carryoverLimitDays,
    unpaidLeaveDeductionDailyRateBasis,
    unpaidLeaveDeductionDayBasis,
  }
}
