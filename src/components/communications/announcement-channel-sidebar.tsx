'use client'

import * as React from 'react'
import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AnnouncementChannelDialog } from '@/components/communications/announcement-channel-dialog'
import type { TargetOption } from '@/components/communications/target-fields'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AnnouncementChannelSidebarItem = {
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

function isGeneralChannel(channel: Pick<AnnouncementChannelSidebarItem, 'name'>) {
  return channel.name.trim().toLowerCase() === 'general'
}

export function AnnouncementChannelSidebar({
  channels,
  selectedChannelId,
  canCreate,
  canEdit,
  canAdministerAll,
  currentUserId,
  departmentOptions,
  userOptions,
  initialCreateOpen = false,
  initialEditChannel = null,
  onDialogClose,
}: {
  channels: AnnouncementChannelSidebarItem[]
  selectedChannelId: string
  canCreate: boolean
  canEdit: boolean
  canAdministerAll: boolean
  currentUserId: string
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  initialCreateOpen?: boolean
  initialEditChannel?: AnnouncementChannelSidebarItem | null
  onDialogClose?: () => void
}) {
  const t = useTranslations('announcements')
  const [createOpen, setCreateOpen] = React.useState(initialCreateOpen)
  const [editOpen, setEditOpen] = React.useState(Boolean(initialEditChannel))
  const [editChannel, setEditChannel] = React.useState<AnnouncementChannelSidebarItem | null>(
    initialEditChannel,
  )

  React.useEffect(() => {
    setCreateOpen(initialCreateOpen)
  }, [initialCreateOpen])

  React.useEffect(() => {
    setEditOpen(Boolean(initialEditChannel))
    setEditChannel(initialEditChannel)
  }, [initialEditChannel])

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open) onDialogClose?.()
  }

  function handleEditOpenChange(open: boolean) {
    setEditOpen(open)
    if (!open) {
      setEditChannel(null)
      onDialogClose?.()
    }
  }

  function openEditDialog(channel: AnnouncementChannelSidebarItem) {
    setEditChannel(channel)
    setEditOpen(true)
  }

  return (
    <>
      <aside className="hidden min-w-0 space-y-3 lg:block">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('channels')}</h2>
          {canCreate && (
            <Button
              type="button"
              size="sm"
              className="h-8 px-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('new')}
            </Button>
          )}
        </div>
        <div className="grid gap-2">
          <Button
            asChild
            variant={selectedChannelId === 'all' ? 'default' : 'outline'}
            className="w-full justify-start overflow-hidden"
          >
            <Link href="/announcements">{t('all')}</Link>
          </Button>
          {channels.map((channel) => {
            const isSelected = selectedChannelId === channel.id
            const canEditChannel =
              canEdit && (canAdministerAll || channel.createdById === currentUserId)
            const showEdit = canEditChannel && !isGeneralChannel(channel) && isSelected

            return (
              <div key={channel.id} className="flex items-center gap-1 w-full min-w-0">
                <Button
                  asChild
                  variant={isSelected ? 'default' : 'outline'}
                  className="min-w-0 flex-1 shrink justify-start overflow-hidden"
                >
                  <Link href={`/announcements?category=${encodeURIComponent(channel.id)}`}>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="relative min-w-0 flex-1 overflow-hidden">
                      <span
                        className={cn(
                          'block truncate',
                          channel.visibility === 'private' && 'pr-14',
                        )}
                      >
                        {channel.name}
                      </span>
                      {channel.visibility === 'private' && (
                        <span
                          className={cn(
                            'pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-r from-transparent pl-5 text-xs',
                            isSelected
                              ? 'to-primary text-primary-foreground/80'
                              : 'to-background text-muted-foreground',
                          )}
                        >
                          {t('privateLabel')}
                        </span>
                      )}
                    </span>
                  </Link>
                </Button>
                {showEdit && (
                  <div className="h-9 w-9">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => openEditDialog(channel)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{t('editChannelSr', { name: channel.name })}</span>
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {canCreate && (
        <AnnouncementChannelDialog
          open={createOpen}
          onOpenChange={handleCreateOpenChange}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
        />
      )}

      {editChannel && (
        <AnnouncementChannelDialog
          open={editOpen}
          onOpenChange={handleEditOpenChange}
          channel={editChannel}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
        />
      )}
    </>
  )
}
