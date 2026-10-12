import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BriefcaseBusiness,
  CalendarCheck,
  ChevronRight,
  CreditCard,
  Package,
  ReceiptText,
  UsersRound,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import { requireAuth } from '@/lib/auth-guards'
import { canShowScopedNavigation, getPermissionScope, hasPermission } from '@/lib/permissions'
import type { User } from '@/lib/rbac'

export const metadata: Metadata = {
  title: 'More',
}

export default async function MorePage() {
  const user = (await requireAuth()) as User
  const t = await getTranslations('navigation')
  const [
    teamMembersScope,
    canViewApplicants,
    leavesScope,
    canViewInventory,
    canViewPayroll,
    canViewExpenses,
  ] = await Promise.all([
    getPermissionScope(user, 'employees', 'view'),
    hasPermission(user, 'applicants', 'view'),
    getPermissionScope(user, 'leaves', 'view'),
    hasPermission(user, 'inventory', 'view'),
    hasPermission(user, 'payroll', 'view'),
    hasPermission(user, 'expenses', 'view'),
  ])

  const items = [
    canShowScopedNavigation(teamMembersScope) && {
      href: '/team-members',
      label: t('teamMembers'),
      Icon: UsersRound,
    },
    canViewApplicants && {
      href: '/applicants',
      label: t('applicants'),
      Icon: BriefcaseBusiness,
    },
    canShowScopedNavigation(leavesScope) && {
      href: '/leaves',
      label: t('leaves'),
      Icon: CalendarCheck,
    },
    canViewInventory && {
      href: '/inventory',
      label: t('inventory'),
      Icon: Package,
    },
    canViewPayroll && {
      href: '/payroll',
      label: t('payroll'),
      Icon: CreditCard,
    },
    canViewExpenses && {
      href: '/expenses',
      label: t('expenses'),
      Icon: ReceiptText,
    },
  ].filter(Boolean) as Array<{
    href: string
    label: string
    Icon: typeof UsersRound
  }>

  if (items.length === 0) redirect('/')

  return (
    <div className="flex w-full flex-1 flex-col overflow-auto px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('more')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('moreDescription')}</p>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          {items.map(({ href, label, Icon }, index) => (
            <Link
              key={href}
              href={href}
              className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 active:bg-muted ${
                index > 0 ? 'border-t' : ''
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </Card>
      </div>
    </div>
  )
}
