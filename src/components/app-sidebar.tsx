'use client'

import * as React from 'react'
import {
  IconBuildingWarehouse,
  IconSettings,
  IconUsers,
  IconCreditCard,
  IconCalendar,
  IconCalendarCheck,
  IconFileText,
  IconHierarchy,
  IconReceipt,
  IconReportAnalytics,
  IconSpeakerphone,
  IconHome,
} from '@tabler/icons-react'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AppLocale } from '@/i18n/config'
import type { AppTheme } from '@/lib/theme'

export function AppSidebar({
  companyName = 'LibreStaff',
  logoUrl = '/brand/LibreStaff-Logo.png',
  canAccessSettings = false,
  canAccessTeamMembers = false,
  canAccessApplicants = false,
  canAccessInventory = false,
  canAccessLeaves = false,
  canAccessPayroll = false,
  canAccessExpenses = false,
  enabledLanguages = ['en'],
  currentLanguage = 'en',
  currentTheme = 'light',
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  companyName?: string
  logoUrl?: string
  canAccessSettings?: boolean
  canAccessTeamMembers?: boolean
  canAccessApplicants?: boolean
  canAccessInventory?: boolean
  canAccessLeaves?: boolean
  canAccessPayroll?: boolean
  canAccessExpenses?: boolean
  enabledLanguages?: string[]
  currentLanguage?: AppLocale
  currentTheme?: AppTheme
}) {
  const t = useTranslations('navigation')
  const baseNav = [
    {
      title: t('home'),
      url: '/',
      icon: IconHome,
    },
    {
      title: t('calendar'),
      url: '/calendar',
      icon: IconCalendar,
    },
    {
      title: t('announcements'),
      url: '/announcements',
      icon: IconSpeakerphone,
    },
    {
      title: t('organization'),
      url: '/organization',
      icon: IconHierarchy,
    },
  ]

  const permissionNav = [
    canAccessTeamMembers && {
      title: t('teamMembers'),
      url: '/team-members',
      icon: IconUsers,
    },
    canAccessApplicants && {
      title: t('applicants'),
      url: '/applicants',
      icon: IconFileText,
    },
    canAccessInventory && {
      title: t('inventory'),
      url: '/inventory',
      icon: IconBuildingWarehouse,
    },
    canAccessLeaves && {
      title: t('leaves'),
      url: '/leaves',
      icon: IconCalendarCheck,
    },
    canAccessPayroll && {
      title: t('payroll'),
      url: '/payroll',
      icon: IconCreditCard,
      items: [
        {
          title: t('records'),
          url: '/payroll',
        },
        {
          title: t('settings'),
          url: '/payroll/settings',
        },
      ],
    },
    canAccessExpenses && {
      title: t('expenses'),
      url: '/expenses',
      icon: IconReceipt,
    },
    canAccessExpenses && {
      title: t('reports'),
      url: '/reports/expenses',
      icon: IconReportAnalytics,
      items: [
        {
          title: t('expenseReports'),
          url: '/reports/expenses',
        },
      ],
    },
  ].filter(Boolean) as typeof baseNav

  const navMain = [...baseNav, ...permissionNav]

  const navSecondary = [
    {
      title: t('settings'),
      url: '/settings/company',
      icon: IconSettings,
    },
  ]

  return (
    <Sidebar className="lg:pt-8 lg:pl-4" collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={companyName}
                  width={32}
                  height={32}
                  className="rounded-sm object-contain"
                />
                <span className="text-base font-semibold">{companyName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        {canAccessSettings && <NavSecondary items={navSecondary} />}
        <NavUser
          enabledLanguages={enabledLanguages}
          currentLanguage={currentLanguage}
          currentTheme={currentTheme}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
