'use client'

import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { saveAnnouncementFormAction } from '@/lib/actions/announcements'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type AnnouncementFormValue = {
  id?: string
  title?: string
  body?: string
  status?: string
  categoryId?: string | null
}

type ChannelOption = {
  id: string
  name: string
  visibility: 'public' | 'private'
}

interface AnnouncementFormProps {
  announcement?: AnnouncementFormValue | null
  channels: ChannelOption[]
}

export function AnnouncementForm({
  announcement,
  channels,
}: AnnouncementFormProps) {
  const t = useTranslations('announcements')
  const isEdit = Boolean(announcement?.id)
  const isSent = announcement?.status === 'sent'

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            {isEdit ? t('editAnnouncement') : t('newAnnouncement')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('formDescription')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/announcements">
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
        </Button>
      </div>

      <form action={saveAnnouncementFormAction}>
        <Card>
          <CardHeader>
            <CardTitle>{t('announcementDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {announcement?.id && <input type="hidden" name="id" value={announcement.id} />}

            <div className="grid gap-2">
              <Label htmlFor="title">{t('announcementTitle')}</Label>
              <Input
                id="title"
                name="title"
                defaultValue={announcement?.title || ''}
                maxLength={255}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="body">{t('body')}</Label>
              <Textarea
                id="body"
                name="body"
                defaultValue={announcement?.body || ''}
                rows={8}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="categoryId">{t('channel')}</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={announcement?.categoryId || channels[0]?.id || ''}
                className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                required
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}{channel.visibility === 'private' ? ` (${t('private')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" name="intent" value="draft" variant="outline">
                {t('saveDraft')}
              </Button>
              <Button type="submit" name="intent" value="send" disabled={isSent}>
                <Send className="h-4 w-4" />
                {isSent ? t('alreadySent') : t('sendAnnouncement')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
