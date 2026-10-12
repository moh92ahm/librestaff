'use client'

import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { deleteCategoryAction } from '@/lib/actions/announcement-feed'
import {
  AnnouncementChannelForm,
  type AnnouncementChannelFormValue,
} from '@/components/communications/announcement-channel-form'
import type { TargetOption } from '@/components/communications/target-fields'
import { Button } from '@/components/ui/button'

type AnnouncementChannelPageContentProps = {
  mode: 'new' | 'edit'
  channel?: AnnouncementChannelFormValue
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
}

export function AnnouncementChannelPageContent({
  mode,
  channel,
  departmentOptions,
  userOptions,
}: AnnouncementChannelPageContentProps) {
  const t = useTranslations('announcements')
  const isEdit = mode === 'edit'

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {isEdit ? t('editChannel') : t('newChannel')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? t('editChannelDescription') : t('newChannelDescription')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/announcements">
            <ArrowLeft className="h-4 w-4" />
            {t('backToAnnouncements')}
          </Link>
        </Button>
      </div>

      <AnnouncementChannelForm
        channel={channel}
        departmentOptions={departmentOptions}
        userOptions={userOptions}
        cancelHref="/announcements"
        redirectTo="/announcements"
        submitLabel={isEdit ? t('saveChannel') : t('createChannel')}
      />

      {channel && (
        <div className="rounded-md border border-destructive/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t('deleteChannel')}</h2>
              <p className="text-sm text-muted-foreground">{t('deleteChannelDescription')}</p>
            </div>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={channel.id} />
              <input type="hidden" name="redirectTo" value="/announcements" />
              <Button type="submit" variant="destructive">
                <Trash2 className="h-4 w-4" />
                {t('deleteChannel')}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
