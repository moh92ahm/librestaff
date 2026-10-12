import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireAuth } from '@/lib/auth-guards'
import { getVisibleAnnouncementForUser } from '@/lib/announcements'
import type { User } from '@/lib/rbac'
import { AnnouncementDetailContent } from '@/components/communications/announcement-detail-content'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('detailTitle'),
  }
}

export default async function ProfileAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await requireAuth()) as User
  const { id } = await params
  const announcement = await getVisibleAnnouncementForUser(id, user)

  if (!announcement) {
    notFound()
  }

  return (
    <AnnouncementDetailContent
      title={announcement.title}
      body={announcement.body}
      sentAt={announcement.sentAt}
    />
  )
}
