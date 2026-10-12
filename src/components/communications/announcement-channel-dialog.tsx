'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { deleteCategoryAction } from '@/lib/actions/announcement-feed'
import {
  AnnouncementChannelForm,
  type AnnouncementChannelFormValue,
} from '@/components/communications/announcement-channel-form'
import type { TargetOption } from '@/components/communications/target-fields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type AnnouncementChannelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel?: AnnouncementChannelFormValue
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
}

export function AnnouncementChannelDialog({
  open,
  onOpenChange,
  channel,
  departmentOptions,
  userOptions,
}: AnnouncementChannelDialogProps) {
  const t = useTranslations('announcements')
  const router = useRouter()
  const isEdit = Boolean(channel?.id)

  function handleDone() {
    onOpenChange(false)
    router.refresh()
  }

  async function handleDelete(formData: FormData) {
    await deleteCategoryAction(formData)
    handleDone()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editChannel') : t('newChannel')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('editChannelDescription') : t('newChannelDescription')}
          </DialogDescription>
        </DialogHeader>

        <AnnouncementChannelForm
          channel={channel}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
          submitLabel={isEdit ? t('saveChannel') : t('createChannel')}
          onCancel={() => onOpenChange(false)}
          onSubmitted={handleDone}
        />

        {channel && (
          <div className="rounded-md border border-destructive/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t('deleteChannel')}</h2>
                <p className="text-sm text-muted-foreground">{t('deleteChannelDescription')}</p>
              </div>
              <form action={handleDelete}>
                <input type="hidden" name="id" value={channel.id} />
                <Button type="submit" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  {t('deleteChannel')}
                </Button>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
