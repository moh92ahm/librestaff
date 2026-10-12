'use client'

import { useTranslations } from 'next-intl'
import type { AnnouncementFeedItem } from '@/lib/announcements'
import { AnnouncementCompose } from '@/components/communications/announcement-compose'
import type { TargetOption } from '@/components/communications/target-fields'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CategoryOption = {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
}

type AnnouncementComposeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  categories: CategoryOption[]
  mentionOptionsByChannel: Record<string, TargetOption[]>
  announcement?: AnnouncementFeedItem
  initialCategoryId?: string
}

export function AnnouncementComposeDialog({
  open,
  onOpenChange,
  departmentOptions,
  userOptions,
  categories,
  mentionOptionsByChannel,
  announcement,
  initialCategoryId,
}: AnnouncementComposeDialogProps) {
  const t = useTranslations('announcements')
  const isEdit = Boolean(announcement?.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editAnnouncement') : t('newAnnouncement')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>

        <AnnouncementCompose
          variant="dialog"
          announcement={announcement}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
          categories={categories}
          mentionOptionsByChannel={mentionOptionsByChannel}
          initialCategoryId={initialCategoryId}
          onCancel={() => onOpenChange(false)}
          onSubmitted={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
