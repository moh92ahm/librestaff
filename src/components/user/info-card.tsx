'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, MapPin, Phone } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'
import { useTranslations } from 'next-intl'

type User = InferSelectModel<typeof usersTable>

interface InfoCardProps {
  user: User
}

export function InfoCard({ user }: InfoCardProps) {
  const t = useTranslations('profile')
  const commonT = useTranslations('common')
  const formatPhoneNumbers = (phones: string | string[] | null | undefined) => {
    if (!phones) return commonT('notSpecified')
    if (Array.isArray(phones)) {
      return phones.join(', ')
    }
    return phones
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>{t('contactInformation')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-6">
        {/* Phone Numbers */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-start space-x-3">
            <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <h4 className="text-sm font-medium">{t('primaryPhone')}</h4>
              <p className="text-sm text-muted-foreground">
                {formatPhoneNumbers(user.primaryPhone) || commonT('notSpecified')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <h4 className="text-sm font-medium">{t('secondaryPhone')}</h4>
              <p className="text-sm text-muted-foreground">
                {user.secondaryPhone || commonT('notSpecified')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="flex items-start space-x-3">
            <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <h4 className="text-sm font-medium">{t('secondaryEmail')}</h4>
              <p className="text-sm text-muted-foreground">
                {user.secondaryEmail || commonT('notSpecified')}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <h4 className="text-sm font-medium">{t('address')}</h4>
              <p className="text-sm text-muted-foreground">{user.address || commonT('notSpecified')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
