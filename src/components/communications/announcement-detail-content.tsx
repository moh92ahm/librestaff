'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type AnnouncementDetailContentProps = {
  title: string
  body: string
  sentAt: string | null
}

function formatDate(value: string | null, locale: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function AnnouncementDetailContent({ title, body, sentAt }: AnnouncementDetailContentProps) {
  const t = useTranslations('announcements')
  const locale = useLocale()

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Button asChild variant="outline">
        <Link href="/announcements">
          <ArrowLeft className="h-4 w-4" />
          {t('backToAnnouncements')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('sentAt', { date: formatDate(sentAt, locale) })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-6">{body}</div>
        </CardContent>
      </Card>
    </div>
  )
}
