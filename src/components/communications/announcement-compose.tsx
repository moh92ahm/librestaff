'use client'

import * as React from 'react'
import { AtSign, Megaphone, Send, Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { postAnnouncementAction, updateAnnouncementAction } from '@/lib/actions/announcement-feed'
import type { AnnouncementFeedItem } from '@/lib/announcements'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiFileUpload, type MultiFileUploadValue } from '@/components/ui/multi-file-upload'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AnnouncementRichTextEditor,
  type AnnouncementEditorMention,
  type AnnouncementRichTextEditorHandle,
} from '@/components/communications/announcement-rich-text-editor'
import type { TargetOption } from '@/components/communications/target-fields'

const BODY_EMOJIS = [
  '👍',
  '❤️',
  '👏',
  '🎉',
  '✅',
  '📌',
  '📣',
  '🙏',
  '😊',
  '🔥',
  '⭐',
  '💡',
] as const

interface CategoryOption {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
}

type MentionOptionsByChannel = Record<string, TargetOption[]>

interface AnnouncementComposeProps {
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  categories: CategoryOption[]
  mentionOptionsByChannel: MentionOptionsByChannel
  announcement?: AnnouncementFeedItem
  initialCategoryId?: string
  onCancel?: () => void
  onSubmitted?: () => void
  variant?: 'inline' | 'dialog'
}

function attachmentValues(announcement?: AnnouncementFeedItem): MultiFileUploadValue[] {
  return (
    announcement?.attachments.map((attachment) => ({
      id: attachment.mediaId,
      filename: attachment.filename,
      filesize: attachment.filesize,
      url: attachment.url,
    })) || []
  )
}

function mentionValues(announcement?: AnnouncementFeedItem): AnnouncementEditorMention[] {
  return announcement?.mentions || []
}

export function AnnouncementCompose({
  departmentOptions,
  userOptions,
  categories,
  mentionOptionsByChannel,
  announcement,
  initialCategoryId,
  onCancel,
  onSubmitted,
  variant = 'inline',
}: AnnouncementComposeProps) {
  const t = useTranslations('announcements')
  void departmentOptions
  void userOptions

  const isEdit = Boolean(announcement?.id)
  const isDialog = variant === 'dialog'
  const [expanded, setExpanded] = React.useState(isEdit || isDialog)
  const [closing, setClosing] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [title, setTitle] = React.useState(announcement?.title || '')
  const [body, setBody] = React.useState(announcement?.body || '')
  const [mentions, setMentions] = React.useState<AnnouncementEditorMention[]>(() =>
    mentionValues(announcement),
  )
  const defaultCategoryId = announcement?.categoryId || initialCategoryId || categories[0]?.id || ''
  const [selectedCategoryId, setSelectedCategoryId] = React.useState(defaultCategoryId)
  const [attachments, setAttachments] = React.useState<MultiFileUploadValue[]>(() =>
    attachmentValues(announcement),
  )
  const editorRef = React.useRef<AnnouncementRichTextEditorHandle>(null)
  const titleRef = React.useRef<HTMLInputElement>(null)
  const mentionOptions = React.useMemo(
    () => mentionOptionsByChannel[selectedCategoryId] || [],
    [mentionOptionsByChannel, selectedCategoryId],
  )

  const resetForm = React.useCallback(() => {
    setTitle(announcement?.title || '')
    setBody(announcement?.body || '')
    setMentions(mentionValues(announcement))
    setSelectedCategoryId(announcement?.categoryId || initialCategoryId || categories[0]?.id || '')
    setAttachments(attachmentValues(announcement))
  }, [announcement, categories, initialCategoryId])

  React.useEffect(() => {
    resetForm()
    setExpanded(isEdit || isDialog)
    setClosing(false)
  }, [isDialog, isEdit, resetForm])

  React.useEffect(() => {
    const allowedIds = new Set(mentionOptions.map((option) => option.value))
    setMentions((current) => current.filter((mention) => allowedIds.has(mention.id)))
  }, [mentionOptions])

  function expandForm() {
    if (isDialog) return
    setExpanded(true)
  }

  function collapseForm() {
    if (isDialog) {
      resetForm()
      onCancel?.()
      return
    }

    setClosing(true)
    window.setTimeout(() => {
      resetForm()
      setClosing(false)
      if (isEdit) {
        onCancel?.()
      } else {
        setExpanded(false)
      }
    }, 450)
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    try {
      if (isEdit) {
        await updateAnnouncementAction(formData)
        onCancel?.()
        onSubmitted?.()
      } else {
        await postAnnouncementAction(formData)
        resetForm()
        setExpanded(isDialog)
        onSubmitted?.()
        window.requestAnimationFrame(() => {
          titleRef.current?.blur()
        })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={isDialog ? 'bg-background' : 'rounded-lg border bg-background shadow-sm'}>
      <form key={announcement?.id || 'new'} action={handleSubmit} className="space-y-0">
        {announcement?.id && <input type="hidden" name="id" value={announcement.id} />}
        <input type="hidden" name="body" value={body} />
        {mentions.map((mention) => (
          <input key={mention.id} type="hidden" name="mentionedUserIds" value={mention.id} />
        ))}

        <div className="flex items-center gap-3 p-3">
          {!isEdit && !isDialog && <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            {(isEdit || isDialog) && (
              <Label
                htmlFor={isEdit ? `announcement-title-${announcement?.id}` : 'announcement-title'}
                className="mb-2 block"
              >
                {t('announcementTitle')}
              </Label>
            )}
            <Input
              ref={titleRef}
              id={isEdit ? `announcement-title-${announcement?.id}` : 'announcement-title'}
              name="title"
              value={title}
              onFocus={expandForm}
              onClick={expandForm}
              onChange={(event) => {
                setTitle(event.target.value)
                expandForm()
              }}
              maxLength={255}
              placeholder={expanded || isDialog ? t('writeTitlePlaceholder') : t('mindPlaceholder')}
              required
              className={
                !isEdit && !isDialog
                  ? `border-0 px-0 shadow-none focus-visible:ring-0 ${
                      expanded ? 'text-base font-semibold' : ''
                    }`
                  : 'font-semibold'
              }
            />
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-[450ms] ease-in-out ${
            expanded && !closing ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid gap-4 border-t p-4">
              <div className="grid gap-2">
                <Label
                  htmlFor={isEdit ? `announcement-body-${announcement?.id}` : 'announcement-body'}
                >
                  {t('body')}
                </Label>
                <AnnouncementRichTextEditor
                  ref={editorRef}
                  id={isEdit ? `announcement-body-${announcement?.id}` : 'announcement-body'}
                  value={body}
                  mentions={mentions}
                  mentionOptions={mentionOptions}
                  onChange={(nextBody, nextMentions) => {
                    setBody(nextBody)
                    setMentions(nextMentions)
                  }}
                />

                <div className="flex flex-wrap items-start gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editorRef.current?.openMention()}
                  >
                    <AtSign className="h-4 w-4" />
                    {t('mention')}
                  </Button>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm">
                        <Smile className="h-4 w-4" />
                        {t('emoji')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64">
                      <div className="grid grid-cols-6 gap-1">
                        {BODY_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => editorRef.current?.insertEmoji(emoji)}
                            className="rounded-md p-2 text-lg hover:bg-accent"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <MultiFileUpload
                    name="attachments"
                    label=""
                    triggerLabel={t('attachment')}
                    value={attachments}
                    onChange={setAttachments}
                    maxFiles={6}
                    compactTrigger
                    className="space-y-2"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div className="grid gap-2">
                  <Label>{t('channel')}</Label>
                  <input type="hidden" name="categoryId" value={selectedCategoryId} />
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.visibility === 'private' ? ` (${t('private')})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isEdit && (
                <label className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="notifyByEmail"
                    className="size-4 shrink-0 rounded border-input"
                  />
                  <span>{t('notifyByEmail')}</span>
                </label>
              )}

              <div className="flex flex-nowrap items-center justify-end gap-2">
                {!isEdit && (
                  <Button
                    type="submit"
                    name="intent"
                    value="draft"
                    variant="outline"
                    disabled={pending}
                    className="min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-4 sm:text-sm"
                  >
                    <span className="truncate">{t('saveDraft')}</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={collapseForm}
                  disabled={pending}
                  className="min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-4 sm:text-sm"
                >
                  <span className="truncate">{t('cancel')}</span>
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value={isEdit ? 'update' : 'post'}
                  disabled={pending}
                  className="min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-4 sm:text-sm"
                >
                  <Send className="size-4 shrink-0" />
                  <span className="truncate">{isEdit ? t('saveChanges') : t('post')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
