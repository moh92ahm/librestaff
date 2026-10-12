import Link from 'next/link'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/actions/notifications'
import { UrlPagination } from '@/components/url-pagination'

type NotificationItem = {
  id: string
  title: string
  message: string
  linkUrl: string
  readAt: string | null
  createdAt: string
  sourceType: string
}

type NotificationsPageContentProps = {
  notifications: NotificationItem[]
  hasUnread: boolean
  currentPage: number
  totalPages: number
  locale: string
  labels: {
    title: string
    description: string
    markAllRead: string
    markRead: string
    open: string
    empty: string
  }
}

export function NotificationsPageContent({
  notifications,
  hasUnread,
  currentPage,
  totalPages,
  locale,
  labels,
}: NotificationsPageContentProps) {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
        </div>
        {hasUnread && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline">
              <CheckCheck className="h-4 w-4" />
              {labels.markAllRead}
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-16 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            {notifications.map((notification, index) => (
              <article
                key={notification.id}
                className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5 ${
                  index > 0 ? 'border-t' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!notification.readAt && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <h2 className="font-medium">{notification.title}</h2>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  <time
                    dateTime={notification.createdAt}
                    className="mt-2 block text-xs text-muted-foreground"
                  >
                    {dateFormatter.format(new Date(notification.createdAt))}
                  </time>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!notification.readAt && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {labels.markRead}
                      </Button>
                    </form>
                  )}
                  <Button asChild size="sm">
                    <Link href={notification.linkUrl}>
                      {labels.open}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <UrlPagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/notifications"
          />
        </>
      )}
    </div>
  )
}
