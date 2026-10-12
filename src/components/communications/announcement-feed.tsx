'use client'

import * as React from 'react'
import { Megaphone, Plus } from 'lucide-react'
import type { AnnouncementFeedItem } from '@/lib/announcements'
import { useTranslations } from 'next-intl'
import type { TargetOption } from '@/components/communications/target-fields'
import { AnnouncementCard } from '@/components/communications/announcement-card'
import { AnnouncementComposeDialog } from '@/components/communications/announcement-compose-dialog'
import {
  AnnouncementChannelMembersPreview,
  type AnnouncementChannelMemberPreviewValue,
} from '@/components/communications/announcement-channel-members-preview'
import { Button } from '@/components/ui/button'

interface CategoryOption {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
}

type MentionOptionsByChannel = Record<string, TargetOption[]>

interface AnnouncementFeedProps {
  items: AnnouncementFeedItem[]
  canManage: boolean
  canPost: boolean
  currentUserId: string
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  categories: CategoryOption[]
  mentionOptionsByChannel: MentionOptionsByChannel
  channelMemberPreview: AnnouncementChannelMemberPreviewValue | null
  selectedCategoryId: string
  initialCreateOpen?: boolean
  initialEditAnnouncement?: AnnouncementFeedItem | null
  onModalClose?: () => void
}

export function AnnouncementFeed({
  items,
  canManage,
  canPost,
  currentUserId,
  departmentOptions,
  userOptions,
  categories,
  mentionOptionsByChannel,
  channelMemberPreview,
  selectedCategoryId,
  initialCreateOpen = false,
  initialEditAnnouncement = null,
  onModalClose,
}: AnnouncementFeedProps) {
  const t = useTranslations('announcements')
  const [createOpen, setCreateOpen] = React.useState(initialCreateOpen)
  const [initialEditOpen, setInitialEditOpen] = React.useState(Boolean(initialEditAnnouncement))
  const initialCategoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : undefined

  React.useEffect(() => {
    setCreateOpen(initialCreateOpen)
  }, [initialCreateOpen])

  React.useEffect(() => {
    setInitialEditOpen(Boolean(initialEditAnnouncement))
  }, [initialEditAnnouncement])

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open) onModalClose?.()
  }

  function handleInitialEditOpenChange(open: boolean) {
    setInitialEditOpen(open)
    if (!open) onModalClose?.()
  }

  return (
    <div className="space-y-4">
      {canPost && (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start gap-3 rounded-lg border-dashed bg-background px-4 text-muted-foreground hover:text-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Megaphone className="h-4 w-4" />
            <span className="flex-1 text-left">{t('mindPlaceholder')}</span>
            <Plus className="h-4 w-4" />
          </Button>

          <AnnouncementComposeDialog
            open={createOpen}
            onOpenChange={handleCreateOpenChange}
            departmentOptions={departmentOptions}
            userOptions={userOptions}
            categories={categories}
            mentionOptionsByChannel={mentionOptionsByChannel}
            initialCategoryId={initialCategoryId}
          />
        </>
      )}

      {initialEditAnnouncement && (
        <AnnouncementComposeDialog
          open={initialEditOpen}
          onOpenChange={handleInitialEditOpenChange}
          announcement={initialEditAnnouncement}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
          categories={categories}
          mentionOptionsByChannel={mentionOptionsByChannel}
        />
      )}

      <AnnouncementChannelMembersPreview preview={channelMemberPreview} />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('noAnnouncements')}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              canManage={canManage}
              canEditOwn={true}
              currentUserId={currentUserId}
              departmentOptions={departmentOptions}
              userOptions={userOptions}
              categories={categories}
              mentionOptionsByChannel={mentionOptionsByChannel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
