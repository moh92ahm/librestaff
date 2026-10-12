'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, ChevronDown, LockKeyhole, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { AnnouncementChannelSidebarItem } from '@/components/communications/announcement-channel-sidebar'
import { cn } from '@/lib/utils'

export function AnnouncementMobileChannelFilter({
  channels,
  selectedChannelId,
  canCreate,
}: {
  channels: AnnouncementChannelSidebarItem[]
  selectedChannelId: string
  canCreate: boolean
}) {
  const t = useTranslations('announcements')
  const [open, setOpen] = React.useState(false)
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId)

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="min-w-0 flex-1 justify-between">
            <span className="flex min-w-0 items-center gap-2">
              {selectedChannel && (
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedChannel.color }}
                />
              )}
              <span className="truncate">{selectedChannel?.name || t('all')}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[75dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{t('channels')}</SheetTitle>
            <SheetDescription>{t('chooseChannel')}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <div className="overflow-hidden rounded-xl border">
              <Link
                href="/announcements"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-12 items-center gap-3 px-4 text-sm',
                  selectedChannelId === 'all' && 'bg-primary/10 text-primary',
                )}
              >
                <span className="size-2.5 rounded-full bg-slate-400" />
                <span className="flex-1 font-medium">{t('all')}</span>
                {selectedChannelId === 'all' && <Check className="size-4" />}
              </Link>
              {channels.map((channel) => {
                const selected = channel.id === selectedChannelId
                return (
                  <Link
                    key={channel.id}
                    href={`/announcements?category=${encodeURIComponent(channel.id)}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex min-h-12 items-center gap-3 border-t px-4 text-sm',
                      selected && 'bg-primary/10 text-primary',
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{channel.name}</span>
                    {channel.visibility === 'private' && (
                      <LockKeyhole className="size-3.5 text-muted-foreground" />
                    )}
                    {selected && <Check className="size-4 shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {canCreate && (
        <Button asChild size="sm" className="shrink-0">
          <Link href="/announcements?channel=new">
            <Plus className="size-4" />
            {t('new')}
          </Link>
        </Button>
      )}
    </div>
  )
}
