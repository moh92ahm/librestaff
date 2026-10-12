import React from 'react'
import './globals.css'
import '@xyflow/react/dist/style.css'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/site-header'
import { AppSidebar } from '@/components/app-sidebar'
import { requireAuth } from '@/lib/auth'
import type { Metadata } from 'next'
import { Lato, Gelasio, JetBrains_Mono } from 'next/font/google'
import { getCompanyMetadata, getOrCreateCompanySettings } from '@/lib/company-settings'
import { isAdmin, type User } from '@/lib/rbac'
import { AppProviders } from '@/components/app-providers'
import { getCurrentUserPreferences } from '@/lib/user-preferences'
import { getMessagesForLocale } from '@/i18n/messages'
import { getNotificationSummary } from '@/lib/notifications'
import { canShowScopedNavigation, getPermissionScope, hasPermission } from '@/lib/permissions'
import { MobileBottomNavigation } from '@/components/mobile-bottom-navigation'
import { appViewport } from '@/lib/app-viewport'

export const viewport = appViewport

const fontSans = Lato({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '700'],
})

const fontSerif = Gelasio({
  subsets: ['latin'],
  variable: '--font-serif',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
}) // Force dynamic rendering for all dashboard pages - prevents static generation at build time
// export const dynamic = 'force-dynamic'
// export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  return getCompanyMetadata({
    description: 'Employee management system',
  })
}

export default async function DashboardLayout(props: { children: React.ReactNode }) {
  // This will redirect to /login if user is not authenticated
  const user = await requireAuth()
  const rbacUser = user as User
  const [
    companySettings,
    preferences,
    notifications,
    teamMembersScope,
    canViewApplicants,
    canViewInventory,
    leavesScope,
    canViewPayroll,
    canViewExpenses,
  ] = await Promise.all([
    getOrCreateCompanySettings(),
    getCurrentUserPreferences(),
    getNotificationSummary(rbacUser.id),
    getPermissionScope(rbacUser, 'employees', 'view'),
    hasPermission(rbacUser, 'applicants', 'view'),
    hasPermission(rbacUser, 'inventory', 'view'),
    getPermissionScope(rbacUser, 'leaves', 'view'),
    hasPermission(rbacUser, 'payroll', 'view'),
    hasPermission(rbacUser, 'expenses', 'view'),
  ])

  const { children } = props
  const messages = getMessagesForLocale(preferences.locale)
  const canViewTeamMembers = canShowScopedNavigation(teamMembersScope)
  const canViewLeaves = canShowScopedNavigation(leavesScope)
  const canViewMore =
    canViewTeamMembers ||
    canViewApplicants ||
    canViewInventory ||
    canViewLeaves ||
    canViewPayroll ||
    canViewExpenses

  return (
    <html lang={preferences.locale} className={preferences.theme} suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} h-dvh overflow-hidden antialiased`}
      >
        <AppProviders locale={preferences.locale} messages={messages} theme={preferences.theme}>
          <SidebarProvider
            className="h-dvh min-h-0 overflow-hidden"
            style={
              {
                '--sidebar-width': 'calc(var(--spacing) * 68)',
                '--header-height': 'calc(var(--spacing) * 20)',
              } as React.CSSProperties
            }
          >
            <AppSidebar
              variant="inset"
              companyName={companySettings.companyName}
              logoUrl={companySettings.logoUrl}
              canAccessSettings={isAdmin(rbacUser)}
              canAccessTeamMembers={canViewTeamMembers}
              canAccessApplicants={canViewApplicants}
              canAccessInventory={canViewInventory}
              canAccessLeaves={canViewLeaves}
              canAccessPayroll={canViewPayroll}
              canAccessExpenses={canViewExpenses}
              enabledLanguages={preferences.enabledLanguages}
              currentLanguage={preferences.locale}
              currentTheme={preferences.theme}
            />
            <SidebarInset className="min-h-0 overflow-hidden">
              <SiteHeader
                notifications={notifications}
                companyName={companySettings.companyName}
                logoUrl={companySettings.logoUrl}
              />
              <main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>
              <MobileBottomNavigation showMore={canViewMore} />
            </SidebarInset>
          </SidebarProvider>
        </AppProviders>
      </body>
    </html>
  )
}
