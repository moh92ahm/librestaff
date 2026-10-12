import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { NotificationsPageContent } from '@/components/notifications/notifications-page-content'
import { requireAuth } from '@/lib/auth-guards'
import { getNotificationsPage } from '@/lib/notifications'
import { getCurrentUserPreferences } from '@/lib/user-preferences'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications')

  return {
    title: t('title'),
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const requestedPage = Math.max(1, Number.parseInt(params?.page || '1', 10) || 1)
  const [t, notificationPage, preferences] = await Promise.all([
    getTranslations('notifications'),
    getNotificationsPage(user.id, requestedPage, 20),
    getCurrentUserPreferences(),
  ])

  return (
    <NotificationsPageContent
      notifications={notificationPage.items}
      hasUnread={notificationPage.unreadCount > 0}
      currentPage={notificationPage.currentPage}
      totalPages={notificationPage.totalPages}
      locale={preferences.locale}
      labels={{
        title: t('title'),
        description: t('description'),
        markAllRead: t('markAllRead'),
        markRead: t('markRead'),
        open: t('open'),
        empty: t('empty'),
      }}
    />
  )
}
