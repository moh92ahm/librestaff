'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'
import { ProfileCard } from './profile-card'
import { InfoCard } from './info-card'
import { PayrollCard } from './payroll-card'
import { UserStatusToggle } from './status-toggle'
import { updateUserStatus } from '@/lib/actions/user'
import type { InferSelectModel } from 'drizzle-orm'
import {
  usersTable,
  inventoryTable,
  leavesTable,
  memberActivityLogsTable,
  payrollTable,
  payrollSettingsTable,
} from '@/db/schema'
import { Card, CardContent } from '../ui/card'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { InventoryCard } from './inventory-card'
import { EmploymentStatusCard } from './employment-status'
import { LeavesCard } from './leaves-card'
import { DocumentsCard } from './documents-card'
import { ActivityCard } from './activity-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnnualLeaveBalance } from '@/lib/leave-policy'
import { useTranslations } from 'next-intl'
import { MobileProfileView } from './mobile-profile-view'
import type { UserPreferences } from '@/lib/user-preferences'

type User = InferSelectModel<typeof usersTable>
type Inventory = InferSelectModel<typeof inventoryTable>
type LeaveDay = InferSelectModel<typeof leavesTable>
type MemberActivity = InferSelectModel<typeof memberActivityLogsTable> & {
  actor?: { fullName?: string | null } | null
}
type Payroll = InferSelectModel<typeof payrollTable>
type PayrollSetting = InferSelectModel<typeof payrollSettingsTable>

interface ProfileLayoutProps {
  user: User
  inventory?: Inventory[]
  leaves?: LeaveDay[]
  payrollHistory?: Payroll[]
  payrollSettings?: PayrollSetting[]
  activity?: MemberActivity[]
  annualLeaveBalance?: AnnualLeaveBalance
  canViewLeaves?: boolean
  canViewPayroll?: boolean
  canViewInventoryItems?: boolean
  canEditInventoryItems?: boolean
  canInlineEditInventory?: boolean
  preferences?: UserPreferences
  /**
   * 'admin'    – shown inside the admin panel (back button, edit, status toggle)
   * 'self'     – shown to the logged-in user, matching the admin profile layout without admin controls
   * 'manager'  – read-only scoped manager view without sensitive tabs/details
   * 'employee' – legacy alias for the logged-in user profile
   */
  variant?: 'admin' | 'employee' | 'self' | 'manager'
}

export function ProfileLayout({
  user,
  inventory = [],
  leaves = [],
  payrollHistory = [],
  payrollSettings = [],
  activity = [],
  annualLeaveBalance,
  canViewLeaves = true,
  canViewPayroll = false,
  canViewInventoryItems = false,
  canEditInventoryItems = false,
  canInlineEditInventory = false,
  preferences,
  variant = 'admin',
}: ProfileLayoutProps) {
  const t = useTranslations('profile')
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')

  const canManageProfile = variant === 'admin'
  const canCreateOwnLeave = variant === 'self' || variant === 'employee'
  const showSensitiveTabs = variant !== 'manager'
  const showInventoryTab =
    showSensitiveTabs || inventory.length > 0 || canViewInventoryItems || canEditInventoryItems
  const tabCount = 3 + (showSensitiveTabs ? 2 : 0) + (showInventoryTab ? 1 : 0)
  const tabGridClass =
    tabCount >= 6
      ? 'grid-cols-2 sm:grid-cols-6'
      : tabCount === 5
        ? 'grid-cols-2 sm:grid-cols-5'
        : tabCount === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : tabCount === 3
            ? 'grid-cols-3'
            : 'grid-cols-2'

  const handleStatusChange = async (isActive: boolean) => {
    await updateUserStatus(String(user.id), isActive)
  }

  const displayName =
    user?.fullName || user?.username || user?.email?.split('@')[0] || 'Unknown User'
  const profileHref =
    variant === 'self' || variant === 'employee' ? '/me' : `/team-members/${user.id}`
  const validTabs = new Set(['profile', 'payroll', 'leaves', 'inventory', 'activity', 'documents'])
  const defaultTab = requestedTab && validTabs.has(requestedTab) ? requestedTab : 'profile'
  const isOwnProfile = variant === 'self' || variant === 'employee'
  const mobileSection =
    requestedTab && validTabs.has(requestedTab)
      ? (requestedTab as 'profile' | 'payroll' | 'leaves' | 'inventory' | 'activity' | 'documents')
      : undefined

  return (
    <div className="min-h-screen bg-background">
      {isOwnProfile && (
        <div className="md:hidden">
          <MobileProfileView
            user={user}
            activeSection={mobileSection}
            preferences={preferences}
            content={{
              profile: (
                <div className="space-y-4">
                  <InfoCard user={user} />
                  <EmploymentStatusCard user={user} />
                </div>
              ),
              payroll: (
                <PayrollCard payrollHistory={payrollHistory} payrollSettings={payrollSettings} />
              ),
              leaves: (
                <LeavesCard
                  leaves={leaves}
                  annualBalance={annualLeaveBalance}
                  createHref="/me/leaves/new"
                />
              ),
              inventory: (
                <InventoryCard
                  inventory={inventory}
                  canViewItems={canViewInventoryItems}
                  canEditItems={canEditInventoryItems}
                  canInlineEdit={canInlineEditInventory}
                />
              ),
              activity: (
                <ActivityCard
                  activity={activity}
                  profileHref={profileHref}
                  canViewLeaves={canViewLeaves}
                  canViewInventory={canViewInventoryItems || canEditInventoryItems}
                  canViewPayroll={canViewPayroll}
                />
              ),
              documents: <DocumentsCard user={user} />,
            }}
          />
        </div>
      )}

      <div className={`container mx-auto space-y-6 p-6 ${isOwnProfile ? 'hidden md:block' : ''}`}>
        {/* Breadcrumb label – admin only */}
        {canManageProfile && <SetBreadcrumbLabel label={displayName} />}

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {canManageProfile && (
              <Link href="/team-members">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Team Members
                </Button>
              </Link>
            )}
            {/* <h1 className="text-2xl font-bold">{t('userProfile')}</h1> */}
          </div>
          {canManageProfile && (
            <div className="flex items-center justify-end gap-3">
              <UserStatusToggle user={user} onStatusChange={handleStatusChange} />
              <Link href={`/team-members/${user.id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  {t('editProfile')}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ProfileCard lives outside the tabs in admin view */}
        <ProfileCard user={user} />

        {/* ── Tabs ── */}
        <Card>
          <CardContent className="pt-2">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className={`grid h-auto w-full ${tabGridClass}`}>
                <TabsTrigger value="profile">{t('info')}</TabsTrigger>
                {showSensitiveTabs && <TabsTrigger value="payroll">{t('payroll')}</TabsTrigger>}
                <TabsTrigger value="leaves">{t('leaves')}</TabsTrigger>
                {showInventoryTab && <TabsTrigger value="inventory">{t('inventory')}</TabsTrigger>}
                <TabsTrigger value="activity">{t('activity')}</TabsTrigger>
                {showSensitiveTabs && <TabsTrigger value="documents">{t('documents')}</TabsTrigger>}
              </TabsList>

              {/* Profile / Info Tab */}
              <TabsContent value="profile" className="space-y-6 mt-2">
                <InfoCard user={user} />
                {showSensitiveTabs && <EmploymentStatusCard user={user} />}
              </TabsContent>

              {/* Payroll Tab */}
              {showSensitiveTabs && (
                <TabsContent value="payroll" className="space-y-6 mt-2">
                  <PayrollCard payrollHistory={payrollHistory} payrollSettings={payrollSettings} />
                </TabsContent>
              )}

              {/* Leaves Tab */}
              <TabsContent value="leaves" className="space-y-6 mt-2">
                <LeavesCard
                  leaves={leaves}
                  annualBalance={annualLeaveBalance}
                  {...(canCreateOwnLeave ? { createHref: '/me/leaves/new' } : {})}
                />
              </TabsContent>

              {/* Inventory Tab */}
              {showInventoryTab && (
                <TabsContent value="inventory" className="space-y-6 mt-2">
                  <InventoryCard
                    inventory={inventory}
                    canViewItems={canViewInventoryItems}
                    canEditItems={canEditInventoryItems}
                    canInlineEdit={canInlineEditInventory}
                  />
                </TabsContent>
              )}

              <TabsContent value="activity" className="space-y-6 mt-2">
                <ActivityCard
                  activity={activity}
                  profileHref={profileHref}
                  canViewLeaves={canViewLeaves}
                  canViewInventory={canViewInventoryItems || canEditInventoryItems}
                  canViewPayroll={canViewPayroll}
                />
              </TabsContent>

              {/* Documents Tab */}
              {showSensitiveTabs && (
                <TabsContent value="documents" className="space-y-6 mt-2">
                  <DocumentsCard user={user} />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
