import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { requireAuth } from '@/lib/auth-guards'
import { isAdmin, type User } from '@/lib/rbac'
import { hasPermission } from '@/lib/permissions'
import { getAnnouncementFeed } from '@/lib/announcements'
import {
  getAnnouncementMentionOptions,
  getPrivateAnnouncementChannelMemberPreview,
  getVisibleAnnouncementChannels,
  isGeneralAnnouncementCategory,
} from '@/lib/announcement-categories'
import { getCommunicationFormOptionsForUser } from '@/lib/communication-options'
import { AnnouncementPageContent } from '@/components/communications/announcement-page-content'
import { Tabs, TabsContent } from '@/components/ui/tabs'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('title'),
  }
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string
    compose?: string
    edit?: string
    channel?: string
    channelEdit?: string
    page?: string
  }>
}) {
  const PAGE_SIZE = 20
  const user = (await requireAuth()) as User
  const [canEditChannels, canCreateChannels] = await Promise.all([
    hasPermission(user, 'announcements', 'edit'),
    hasPermission(user, 'announcements', 'create'),
  ])
  const canAdministerAllChannels = isAdmin(user)
  const params = await searchParams
  const selectedCategoryId = params?.category || 'all'
  const requestedPage = Math.max(1, Number.parseInt(params?.page || '1', 10) || 1)

  const [feed, options, categories, mentionOptionsByChannel] = await Promise.all([
    getAnnouncementFeed(user),
    getCommunicationFormOptionsForUser(user),
    getVisibleAnnouncementChannels(user),
    getAnnouncementMentionOptions(user),
  ])
  const selectedChannel = categories.find((category) => category.id === selectedCategoryId)
  const channelMemberPreview = await getPrivateAnnouncementChannelMemberPreview(selectedChannel)

  const filteredFeed =
    selectedCategoryId === 'all'
      ? feed
      : feed.filter((item) => item.categoryId === selectedCategoryId)
  const totalPages = Math.max(1, Math.ceil(filteredFeed.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const visibleFeed = filteredFeed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pinned = filteredFeed.filter((item) => item.pinned)
  const canPost = categories.length > 0
  const initialCreateOpen = params?.compose === 'new' && canPost
  const initialEditAnnouncement = params?.edit
    ? feed.find((item) => item.id === params.edit && item.createdById === user.id) || null
    : null
  const initialChannelCreateOpen = params?.channel === 'new' && canCreateChannels
  const initialEditChannel =
    params?.channelEdit && canEditChannels
      ? categories.find(
          (category) =>
            category.id === params.channelEdit &&
            !isGeneralAnnouncementCategory(category) &&
            (canAdministerAllChannels || category.createdById === user.id),
        ) || null
      : null

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <AnnouncementPageContent
          visibleFeed={visibleFeed}
          pinned={pinned}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          canCreateChannels={canCreateChannels}
          canEditChannels={canEditChannels}
          canAdministerAllChannels={canAdministerAllChannels}
          canPost={canPost}
          currentUserId={user.id}
          departmentOptions={options.departments}
          userOptions={options.users}
          mentionOptionsByChannel={mentionOptionsByChannel}
          channelMemberPreview={channelMemberPreview}
          initialCreateOpen={initialCreateOpen}
          initialEditAnnouncement={initialEditAnnouncement}
          initialChannelCreateOpen={initialChannelCreateOpen}
          initialEditChannel={initialEditChannel}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      </TabsContent>
    </Tabs>
  )
}
