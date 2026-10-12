'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AnnouncementFeedItem } from '@/lib/announcements'
import { AnnouncementFeed } from '@/components/communications/announcement-feed'
import { AnnouncementCard } from '@/components/communications/announcement-card'
import { AnnouncementChannelSidebar } from '@/components/communications/announcement-channel-sidebar'
import type { AnnouncementChannelMemberPreviewValue } from '@/components/communications/announcement-channel-members-preview'
import type { TargetOption } from '@/components/communications/target-fields'
import { AnnouncementMobileChannelFilter } from '@/components/communications/announcement-mobile-channel-filter'
import { AnnouncementPagination } from '@/components/communications/announcement-pagination'

type CategoryOption = {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
  createdById?: string | null
}

type AnnouncementPageContentProps = {
  visibleFeed: AnnouncementFeedItem[]
  pinned: AnnouncementFeedItem[]
  categories: CategoryOption[]
  selectedCategoryId: string
  canCreateChannels: boolean
  canEditChannels: boolean
  canAdministerAllChannels: boolean
  canPost: boolean
  currentUserId: string
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  mentionOptionsByChannel: Record<string, TargetOption[]>
  channelMemberPreview: AnnouncementChannelMemberPreviewValue | null
  initialCreateOpen?: boolean
  initialEditAnnouncement?: AnnouncementFeedItem | null
  initialChannelCreateOpen?: boolean
  initialEditChannel?: CategoryOption | null
  currentPage: number
  totalPages: number
}

export function AnnouncementPageContent({
  visibleFeed,
  pinned,
  categories,
  selectedCategoryId,
  canCreateChannels,
  canEditChannels,
  canAdministerAllChannels,
  canPost,
  currentUserId,
  departmentOptions,
  userOptions,
  mentionOptionsByChannel,
  channelMemberPreview,
  initialCreateOpen = false,
  initialEditAnnouncement = null,
  initialChannelCreateOpen = false,
  initialEditChannel = null,
  currentPage,
  totalPages,
}: AnnouncementPageContentProps) {
  const t = useTranslations('announcements')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function clearModalParams() {
    if (
      !searchParams.has('compose') &&
      !searchParams.has('edit') &&
      !searchParams.has('channel') &&
      !searchParams.has('channelEdit')
    ) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('compose')
    nextParams.delete('edit')
    nextParams.delete('channel')
    nextParams.delete('channelEdit')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <>
      <div className="py-4 lg:p-0 lg:pt-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <AnnouncementMobileChannelFilter
        channels={categories}
        selectedChannelId={selectedCategoryId}
        canCreate={canCreateChannels}
      />

      <div className="grid gap-6 pb-6 lg:grid-cols-[220px_1fr_280px]">
        <AnnouncementChannelSidebar
          channels={categories}
          selectedChannelId={selectedCategoryId}
          canCreate={canCreateChannels}
          canEdit={canEditChannels}
          canAdministerAll={canAdministerAllChannels}
          currentUserId={currentUserId}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
          initialCreateOpen={initialChannelCreateOpen}
          initialEditChannel={initialEditChannel}
          onDialogClose={clearModalParams}
        />

        <div className="min-w-0">
          <AnnouncementFeed
            items={visibleFeed}
            canManage={true}
            canPost={canPost}
            currentUserId={currentUserId}
            departmentOptions={departmentOptions}
            userOptions={userOptions}
            categories={categories}
            mentionOptionsByChannel={mentionOptionsByChannel}
            channelMemberPreview={channelMemberPreview}
            selectedCategoryId={selectedCategoryId}
            initialCreateOpen={initialCreateOpen}
            initialEditAnnouncement={initialEditAnnouncement}
            onModalClose={clearModalParams}
          />
          <AnnouncementPagination
            currentPage={currentPage}
            totalPages={totalPages}
            selectedCategoryId={selectedCategoryId}
          />
        </div>

        <aside className="hidden min-w-0 space-y-3 lg:block">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('pinnedAnnouncements')}</h2>
          </div>

          {pinned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noPinnedAnnouncements')}</p>
          ) : (
            <div className="space-y-3">
              {pinned.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  variant="pinned"
                  canManage={true}
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
        </aside>
      </div>
    </>
  )
}
