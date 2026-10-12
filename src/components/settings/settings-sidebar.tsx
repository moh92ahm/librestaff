'use client'

import Link from 'next/link'
import { Building2, CalendarClock, Mail, Plane, ShieldCheck, UsersRound, Workflow } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const settingsItems = [
  {
    titleKey: 'company',
    href: '/settings/company',
    icon: Building2,
  },
  {
    titleKey: 'roles',
    href: '/settings/roles',
    icon: ShieldCheck,
  },
  {
    titleKey: 'departments',
    href: '/settings/departments',
    icon: UsersRound,
  },
  {
    titleKey: 'email',
    href: '/settings/email',
    icon: Mail,
  },
  {
    titleKey: 'workflows',
    href: '/settings/workflows',
    icon: Workflow,
  },
  {
    titleKey: 'cron',
    href: '/settings/cron',
    icon: CalendarClock,
  },
  {
    titleKey: 'leaves',
    href: '/settings/leaves',
    icon: Plane,
  },
]

export function SettingsSidebar() {
  const t = useTranslations('settings')
  const pathname = usePathname()

  return (
    <aside className="shrink-0 border-b bg-muted/20 md:w-64 md:border-b-0 md:border-r">
      <div className="border-b px-4 py-4">
        <div>
          <h2 className="text-base font-semibold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('adminConfiguration')}</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
        {settingsItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:w-full',
                active && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{t(item.titleKey)}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
