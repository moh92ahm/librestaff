'use client'

import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/actions/notifications'
import { useTranslations } from 'next-intl'

export type NotificationBellItem = {
  id: string
  title: string
  message: string
  linkUrl: string
  readAt: string | null
  createdAt: string
  sourceType: string
}

interface NotificationBellProps {
  unreadCount: number
  items: NotificationBellItem[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function NotificationBell({ unreadCount, items }: NotificationBellProps) {
  const t = useTranslations('notifications')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">{t('title')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(80vh,42rem)] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="px-0">{t('title')}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="ghost" size="sm">
                <CheckCheck className="h-4 w-4" />
                {t('markAllRead')}
              </Button>
            </form>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="block p-0">
              <div className="w-full px-2 py-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <Link
                    href={item.linkUrl}
                    className="min-w-0 space-y-1"
                    title={`${item.title}\n\n${item.message}`}
                  >
                    <div className="min-w-0 space-y-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {!item.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
                        <span className="truncate text-sm font-medium" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
                      <p
                        className="whitespace-pre-wrap break-words text-xs text-muted-foreground pt-2"
                        title={item.message}
                      >
                        {item.message}
                      </p>
                    </div>
                  </Link>
                  {!item.readAt && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="outline" size="sm" className="whitespace-nowrap">
                        {t('markRead')}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="w-full justify-center font-medium">
            {t('showAll')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
