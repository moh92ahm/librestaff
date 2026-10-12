'use client'

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { usePathname } from 'next/navigation'
import { AppBreadcrumbs } from '@/components/app-breadcrumbs'
import { useTranslations } from 'next-intl'
import {
  NotificationBell,
  type NotificationBellItem,
} from '@/components/notifications/notification-bell'
import { HelpGuideButton } from '@/components/help-guide-button'

function toTitle(input: string, t: (key: string) => string) {
  if (!input) return ''
  // map common segments
  const map: Record<string, string> = {
    inventory: t('inventory'),
    users: t('teamMembers'),
    'team-members': t('teamMembers'),
    me: 'My Profile',
    departments: t('departments'),
    applicants: t('applicants'),
    calendar: t('calendar'),
    announcements: t('announcements'),
    leaves: t('leaves'),
    payroll: t('payroll'),
    settings: t('settings'),
    workflows: 'Workflows',
    cron: t('cronJobSettings'),
    expenses: t('expenses'),
    new: t('new'),
    edit: t('edit'),
  }
  if (map[input]) return map[input]
  // numeric or uuid-ish id → Details
  const isId = /^\d+$/.test(input) || /[a-f0-9-]{8,}/i.test(input)
  if (isId) return t('details')
  // default Title Case
  return input
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

export function SiteHeader({
  notifications,
  companyName = 'LibreStaff',
  logoUrl = '/brand/LibreStaff-Logo.png',
}: {
  notifications?: { unreadCount: number; items: NotificationBellItem[] }
  companyName?: string
  logoUrl?: string
}) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const segments = (pathname || '/').split('/').filter(Boolean)
  const items = [
    { label: t('home'), href: '/' },
    ...segments.map((seg, idx) => {
      const isId = /^\d+$/.test(seg) || /[a-f0-9-]{8,}/i.test(seg)
      const path = `/${segments.slice(0, idx + 1).join('/')}`

      // Don't create href for ID segments unless we know they have detail pages
      const hasDetailPage = (segments[0] === 'users' || segments[0] === 'team-members') && isId

      return {
        label: toTitle(seg, t),
        href: isId && !hasDetailPage ? undefined : path,
      }
    }),
  ]
  // Apply runtime label override for entity segment
  if (typeof window !== 'undefined') {
    const overrideMap = (window as any).__breadcrumbOverride as Record<string, string> | undefined
    if (overrideMap) {
      const last = segments[segments.length - 1]
      const isEditOrNew = last === 'edit' || last === 'new'
      const targetPath = isEditOrNew ? `/${segments.slice(0, -1).join('/')}` : pathname || '/'
      const label = overrideMap[targetPath]
      if (label) {
        const targetIndex = isEditOrNew ? items.length - 2 : items.length - 1
        if (targetIndex >= 0 && targetIndex < items.length) {
          items[targetIndex] = { ...items[targetIndex], label }
        }
      }
    }
  }
  return (
    <header className="flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b pt-[env(safe-area-inset-top)] transition-[width,height] ease-linear md:h-(--header-height) md:pt-0">
      <div className="flex w-full items-center gap-2 px-3 md:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={companyName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            width={34}
            height={34}
            className="size-8 rounded-md object-contain"
          />
          <span className="max-w-40 truncate text-sm font-semibold">{companyName}</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <HelpGuideButton />
          {notifications && (
            <NotificationBell unreadCount={notifications.unreadCount} items={notifications.items} />
          )}
        </div>
      </div>

      <div className="hidden w-full items-center gap-1 px-4 md:flex lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <AppBreadcrumbs items={items} />
        {notifications && (
          <div className="ml-auto flex items-center gap-1">
            <HelpGuideButton />
            <NotificationBell unreadCount={notifications.unreadCount} items={notifications.items} />
          </div>
        )}
      </div>
    </header>
  )
}
