import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { ProfileLayout } from '@/components/user/profile-layout'
import { eq } from 'drizzle-orm'
import {
  usersTable,
  inventoryTable,
  leavesTable,
  memberActivityLogsTable,
  payrollTable,
  payrollSettingsTable,
} from '@/db/schema'
import { getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { getAnnualLeaveBalance } from '@/lib/leave-policy'
import type { User as RbacUser } from '@/lib/rbac'
import { getCurrentUserPreferences } from '@/lib/user-preferences'

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'View and manage your profile',
}

export default async function EmployeeProfilePage() {
  const user = await getCurrentUser()

  if (!user || !user.id) {
    redirect('/login')
  }

  const userId = user.id
  const rbacUser = user as RbacUser
  const [canViewInventoryItems, canEditInventoryItems, preferences] = await Promise.all([
    hasPermission(rbacUser, 'inventory', 'view'),
    hasPermission(rbacUser, 'inventory', 'edit'),
    getCurrentUserPreferences(),
  ])

  // Fetch full user data with relations
  const userData = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    with: {
      role: true,
      department: true,
    },
  })

  if (!userData) {
    redirect('/login')
  }

  // Fetch user's inventory
  const inventory = await db.query.inventoryTable.findMany({
    where: eq(inventoryTable.holderId, userId),
    with: {
      holder: true,
    },
  })

  // Fetch user's leaves
  const leaves = await db.query.leavesTable.findMany({
    where: eq(leavesTable.userId, userId),
    orderBy: (leaves, { desc }) => [desc(leaves.startDate)],
    with: {
      user: true,
    },
  })

  // Fetch user's payroll history
  const payrollHistory = await db.query.payrollTable.findMany({
    where: eq(payrollTable.employeeId, userId),
    orderBy: (payroll, { desc }) => [desc(payroll.createdAt)],
    with: {
      employee: true,
      processedBy: true,
    },
  })

  // Fetch user's payroll settings
  const payrollSettings = await db.query.payrollSettingsTable.findMany({
    where: eq(payrollSettingsTable.employeeId, userId),
    with: {
      employee: true,
    },
  })

  const activity = await db.query.memberActivityLogsTable.findMany({
    where: eq(memberActivityLogsTable.subjectUserId, userId),
    orderBy: (activity, { desc }) => [desc(activity.createdAt)],
    limit: 100,
    with: {
      actor: {
        columns: {
          fullName: true,
        },
      },
    },
  })

  const { policy, tiers } = await getLeavePolicyConfig()
  const annualLeaveBalance = getAnnualLeaveBalance(userData, leaves, tiers, policy)

  return (
    <ProfileLayout
      variant="self"
      user={userData}
      inventory={inventory}
      leaves={leaves}
      payrollHistory={payrollHistory}
      payrollSettings={payrollSettings}
      activity={activity}
      annualLeaveBalance={annualLeaveBalance}
      canViewLeaves
      canViewPayroll
      canViewInventoryItems={canViewInventoryItems || canEditInventoryItems}
      canEditInventoryItems={canEditInventoryItems}
      canInlineEditInventory={canEditInventoryItems}
      preferences={preferences}
    />
  )
}
