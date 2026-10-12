'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Grid2X2, Home, Megaphone, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const baseItems = [
  {
    key: 'home',
    href: '/',
    icon: Home,
    isActive: (pathname: string) => pathname === '/',
  },
  {
    key: 'calendar',
    href: '/calendar',
    icon: CalendarDays,
    isActive: (pathname: string) => pathname === '/calendar' || pathname.startsWith('/calendar/'),
  },
  {
    key: 'announcements',
    href: '/announcements',
    icon: Megaphone,
    isActive: (pathname: string) =>
      pathname === '/announcements' || pathname.startsWith('/announcements/'),
  },
  {
    key: 'profile',
    href: '/me',
    icon: UserRound,
    isActive: (pathname: string) => pathname === '/me' || pathname.startsWith('/me/'),
  },
] as const

const moreItem = {
  key: 'more',
  href: '/more',
  icon: Grid2X2,
  isActive: (pathname: string) =>
    [
      '/more',
      '/team-members',
      '/applicants',
      '/leaves',
      '/inventory',
      '/payroll',
      '/expenses',
      '/reports',
    ].some((path) => pathname === path || pathname.startsWith(`${path}/`)),
} as const

export function MobileBottomNavigation({ showMore = false }: { showMore?: boolean }) {
  const pathname = usePathname() || '/'
  const t = useTranslations('navigation')
  const items = showMore ? [...baseItems, moreItem] : baseItems

  return (
    <nav
      aria-label={t('mobileNavigation')}
      className="relative z-40 shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(0,0,0,0.06)] md:hidden"
    >
      <div className={cn('mx-auto grid h-16 max-w-lg', showMore ? 'grid-cols-5' : 'grid-cols-4')}>
        {items.map((item) => {
          const active = item.isActive(pathname)
          const Icon = item.icon

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              <span className="max-w-full truncate">
                {item.key === 'announcements' ? t('announcementsShort') : t(item.key)}
              </span>
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
