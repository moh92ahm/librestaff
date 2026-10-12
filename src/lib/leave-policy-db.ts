import { db } from '@/db'
import {
  leaveEntitlementTiersTable,
  leavePolicySettingsTable,
  leavesTable,
  type usersTable,
} from '@/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'
import {
  DEFAULT_LEAVE_ENTITLEMENT_TIERS,
  DEFAULT_LEAVE_POLICY,
  getAnnualLeaveBalance,
  normalizeLeavePolicy,
  type AnnualLeaveBalance,
} from '@/lib/leave-policy'
import type { InferSelectModel } from 'drizzle-orm'

type User = InferSelectModel<typeof usersTable>

export async function getOrCreateLeavePolicySettings() {
  const existing = await db.query.leavePolicySettingsTable.findFirst({
    orderBy: (settings, { asc }) => [asc(settings.createdAt)],
  })

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(leavePolicySettingsTable)
    .values(DEFAULT_LEAVE_POLICY)
    .returning()
  return created
}

export async function getOrCreateLeaveEntitlementTiers() {
  const existing = await db
    .select()
    .from(leaveEntitlementTiersTable)
    .orderBy(asc(leaveEntitlementTiersTable.minimumServiceMonths))

  if (existing.length > 0) {
    return existing
  }

  return db
    .insert(leaveEntitlementTiersTable)
    .values(
      DEFAULT_LEAVE_ENTITLEMENT_TIERS.map((tier) => ({
        minimumServiceMonths: tier.minimumServiceMonths,
        days: tier.days,
        label: tier.label || `After ${tier.minimumServiceMonths} months`,
        isActive: tier.isActive !== false,
      })),
    )
    .returning()
}

export async function getLeavePolicyConfig() {
  const [policy, tiers] = await Promise.all([
    getOrCreateLeavePolicySettings(),
    getOrCreateLeaveEntitlementTiers(),
  ])

  return {
    policy: normalizeLeavePolicy(policy),
    settings: policy,
    tiers,
  }
}

export async function getUserAnnualLeaveBalance(
  user: Pick<User, 'id' | 'joinedAt'>,
  asOfDate: Date | string = new Date(),
): Promise<AnnualLeaveBalance> {
  const { policy, tiers } = await getLeavePolicyConfig()
  const leaves = await db.query.leavesTable.findMany({
    where: eq(leavesTable.userId, user.id),
  })

  return getAnnualLeaveBalance(user, leaves, tiers, policy, asOfDate)
}

export async function getAnnualLeaveBalancesForUsers(
  users: Array<Pick<User, 'id' | 'joinedAt'>>,
  asOfDate: Date | string = new Date(),
) {
  const { policy, tiers } = await getLeavePolicyConfig()
  const userIds = users.map((user) => user.id)
  const leaves =
    userIds.length > 0
      ? await db.query.leavesTable.findMany({
          where: inArray(leavesTable.userId, userIds),
        })
      : []

  return Object.fromEntries(
    users.map((user) => [
      user.id,
      getAnnualLeaveBalance(
        user,
        leaves.filter((leave) => leave.userId === user.id),
        tiers,
        policy,
        asOfDate,
      ),
    ]),
  )
}
