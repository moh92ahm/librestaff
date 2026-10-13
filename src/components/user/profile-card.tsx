'use client'

import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable> & {
  role?: { id: string; name: string; displayName?: string | null } | null
  department?: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    description: string | null
  } | null
}
import { formatDate } from '@/lib/date-utils'
import { AtSign, BriefcaseBusiness, CalendarDays, IdCard, Mail } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

interface ProfileCardProps {
  user: User
}

export function ProfileCard({ user }: ProfileCardProps) {
  const t = useTranslations('profile')
  const commonT = useTranslations('common')
  const locale = useLocale()
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  const department = user.department?.name || 'No department'

  const role = user.role?.displayName || user.role?.name || 'No role'

  const summaryItems = [
    {
      label: t('loginEmail').replace(':', ''),
      value: user.email || commonT('notSpecified'),
      icon: Mail,
    },
    {
      label: t('username').replace(':', ''),
      value: user.username || commonT('notSpecified'),
      icon: AtSign,
    },
    {
      label: t('joinedAt').replace(':', ''),
      value: user.joinedAt ? formatDate(user.joinedAt, locale) : commonT('notSpecified'),
      icon: BriefcaseBusiness,
    },
    {
      label: t('birthDate').replace(':', ''),
      value: user.birthDate ? formatDate(user.birthDate, locale) : commonT('notSpecified'),
      icon: CalendarDays,
    },
  ]

  return (
    <Card className="overflow-hidden pt-0">
      <div className="profile-hero-gradient relative h-40 overflow-hidden md:h-52">
        <div className="absolute inset-0 top-0 bg-[radial-gradient(circle_at_18%_30%,color-mix(in_oklab,var(--background)_42%,transparent),transparent_28%),radial-gradient(circle_at_82%_24%,color-mix(in_oklab,var(--accent)_38%,transparent),transparent_24%)]" />
      </div>
      <CardContent className="px-4 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="-mt-14 h-28 w-28 border-4 border-card shadow-lg md:-mt-28 md:h-40 md:w-40">
              <AvatarImage src={user.photo || ''} alt={user.fullName} className="object-cover" />
              <AvatarFallback className="text-3xl">{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold md:text-3xl">{user.fullName}</h2>
                <Badge variant={user.isActive ? 'default' : 'secondary'}>
                  {user.isActive ? commonT('active') : commonT('inactive')}
                </Badge>
              </div>
              <p className="mt-1 text-base text-muted-foreground">
                {user.jobTitle || commonT('notSpecified')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <IdCard className="size-3.5" />
                  {String(role)}
                </Badge>
                <Badge variant="secondary">{department}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex min-w-0 items-start gap-3 rounded-md p-2">
              <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="truncate text-sm font-medium">{item.value}</p>
              </div>
            </div>
          ))}
          {/* <div className="flex min-w-0 items-start gap-3 rounded-md p-2">
            <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {t('status').replace(':', '')}
              </p>
              <p className="text-sm font-medium">
                {user.isActive ? commonT('active') : commonT('inactive')}
              </p>
            </div>
          </div> */}
        </div>
      </CardContent>
    </Card>
  )
}
