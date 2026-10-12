'use client'
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable>
import { formatDate } from '@/lib/date-utils'
import { useLocale, useTranslations } from 'next-intl'

interface EmploymentStatusCardProps {
  user: User
}

export function EmploymentStatusCard({ user }: EmploymentStatusCardProps) {
  const t = useTranslations('profile')
  const commonT = useTranslations('common')
  const employmentT = useTranslations('labels.employmentTypes')
  const locale = useLocale()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('employmentStatus')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium">{t('nationality')}</div>
          <div className="text-muted-foreground">{user.nationality || commonT('notSpecified')}</div>
        </div>
        <div>
          <div className="font-medium">{t('identificationNo')}</div>
          <div className="text-muted-foreground">
            {user.identityNumber || commonT('notSpecified')}
          </div>
        </div>
        <div>
          <div className="font-medium">{t('employmentType')}</div>
          <div className="text-muted-foreground">
            {user.employmentType
              ? employmentT(user.employmentType as any)
              : commonT('notSpecified')}
          </div>
        </div>
        {user.employmentStartDate ? (
          <div>
            <div className="font-medium">{t('officialStartDate')}</div>
            <div className="text-muted-foreground">
              {formatDate(user.employmentStartDate, locale)}
            </div>
          </div>
        ) : null}
        {user.employmentNote ? (
          <div className="md:col-span-2">
            <div className="font-medium">{t('employmentNote')}</div>
            <div className="whitespace-pre-wrap text-muted-foreground">{user.employmentNote}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
