import { notFound } from 'next/navigation'
import { db } from '@/db'
import { canAccessTargetUser, requirePermission } from '@/lib/permissions'
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

interface UserProfilePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { id } = await params
  const currentUser = await requirePermission('employees', 'view')

  try {
    const canViewProfile = await canAccessTargetUser(currentUser, 'employees', 'view', id)
    if (!canViewProfile) {
      notFound()
    }
    const [
      canEditProfile,
      canViewLeaves,
      canViewInventory,
      canEditInventory,
      canViewPayroll,
    ] = await Promise.all([
      canAccessTargetUser(currentUser, 'employees', 'edit', id),
      canAccessTargetUser(currentUser, 'leaves', 'view', id),
      canAccessTargetUser(currentUser, 'inventory', 'view', id),
      canAccessTargetUser(currentUser, 'inventory', 'edit', id),
      canAccessTargetUser(currentUser, 'payroll', 'view', id),
    ])

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
      with: {
        role: true,
        department: true,
      },
    })

    if (!user) {
      notFound()
    }

    const leaves = canViewLeaves
      ? await db.query.leavesTable.findMany({
          where: eq(leavesTable.userId, user.id),
          orderBy: (leaves, { desc }) => [desc(leaves.createdAt)],
          with: {
            user: true,
          },
        })
      : []

    const [inventory, payrolls, payrollSettings] = canViewInventory || canEditInventory || canViewPayroll
      ? await Promise.all([
          canViewInventory || canEditInventory
            ? db.query.inventoryTable.findMany({
                where: eq(inventoryTable.holderId, user.id),
                with: {
                  holder: true,
                },
              })
            : [],
          canViewPayroll
            ? db.query.payrollTable.findMany({
                where: eq(payrollTable.employeeId, user.id),
                orderBy: (payroll, { desc }) => [desc(payroll.createdAt)],
                with: {
                  employee: true,
                  processedBy: true,
                },
              })
            : [],
          canViewPayroll
            ? db.query.payrollSettingsTable.findMany({
                where: eq(payrollSettingsTable.employeeId, user.id),
                orderBy: (settings, { desc }) => [desc(settings.createdAt)],
                with: {
                  employee: true,
                },
              })
            : [],
        ])
      : [[], [], []]
    const activity = await db.query.memberActivityLogsTable.findMany({
      where: eq(memberActivityLogsTable.subjectUserId, user.id),
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
    const annualLeaveBalance = getAnnualLeaveBalance(user, leaves, tiers, policy)

    return (
      <ProfileLayout
        user={user}
        inventory={inventory as any[]}
        leaves={leaves as any[]}
        payrollHistory={payrolls as any[]}
        payrollSettings={payrollSettings as any[]}
        activity={activity as any[]}
        annualLeaveBalance={annualLeaveBalance}
        canViewLeaves={canViewLeaves}
        canViewPayroll={canViewPayroll}
        variant={canEditProfile ? 'admin' : 'manager'}
        canViewInventoryItems={canViewInventory || canEditInventory}
        canEditInventoryItems={canEditInventory}
        canInlineEditInventory={canEditInventory}
      />
    )
  } catch (error) {
    console.error('Error fetching user:', error)
    notFound()
  }
}
