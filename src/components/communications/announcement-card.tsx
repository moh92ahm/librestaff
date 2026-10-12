'use client'

import * as React from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import {
  AtSign,
  FileText,
  MessageCircle,
  MoreVertical,
  Pin,
  PinOff,
  Smile,
  SmilePlus,
} from 'lucide-react'
import {
  addCommentAction,
  pinAnnouncementAction,
  toggleCommentReactionAction,
  toggleReactionAction,
} from '@/lib/actions/announcement-feed'
import type { AnnouncementFeedItem } from '@/lib/announcements'
import { AnnouncementComposeDialog } from '@/components/communications/announcement-compose-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MultiFileUpload, type MultiFileUploadValue } from '@/components/ui/multi-file-upload'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AnnouncementRichTextEditor,
  type AnnouncementEditorMention,
  type AnnouncementRichTextEditorHandle,
} from '@/components/communications/announcement-rich-text-editor'
import type { TargetOption } from '@/components/communications/target-fields'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏'] as const
const OPEN_COMMENTS_EVENT = 'open-announcement-comments'

function formatDate(value: string | null, locale: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function AuthorAvatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
        <Image
          src={photo}
          alt={name}
          width={36}
          height={36}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {initials}
    </div>
  )
}

interface AnnouncementCardProps {
  item: AnnouncementFeedItem
  canManage: boolean
  canEditOwn?: boolean
  variant?: 'default' | 'pinned'
  currentUserId: string
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  categories: Array<{
    id: string
    name: string
    color: string
    visibility: 'public' | 'private'
    notifyInApp: boolean
    notifyEmail: boolean
    departmentIds: string[]
    userIds: string[]
  }>
  mentionOptionsByChannel: Record<string, TargetOption[]>
}

function ReactionButtons({
  reactionCounts,
  myReactions,
  onReact,
  size = 'default',
}: {
  reactionCounts: Record<string, number>
  myReactions: string[]
  onReact: (emoji: string) => void | Promise<void>
  size?: 'default' | 'compact'
}) {
  const t = useTranslations('announcements')
  const [open, setOpen] = React.useState(false)
  const activeReaction = myReactions[0]
  const totalCount = Object.values(reactionCounts).reduce((total, count) => total + count, 0)
  const reactedEmojis = EMOJIS.filter((emoji) => (reactionCounts[emoji] ?? 0) > 0)

  async function handleSelect(emoji: string) {
    await onReact(emoji)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={activeReaction ? 'ghost' : 'outline'}
            size={size === 'compact' ? 'sm' : 'default'}
            className={
              size === 'compact'
                ? 'h-7 gap-1 rounded-full px-2 text-xs'
                : 'h-8 gap-1.5 rounded-full px-3 text-sm'
            }
          >
            {activeReaction ? (
              <span className={size === 'compact' ? 'text-sm' : 'text-base'}>{activeReaction}</span>
            ) : (
              <SmilePlus className="h-4 w-4" />
            )}
            <span>{t('react')}</span>
            {totalCount > 0 && <span className="text-xs text-muted-foreground">{totalCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
          <div className="flex gap-1">
            {EMOJIS.map((emoji) => {
              const active = myReactions.includes(emoji)
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className={`rounded-full p-2 text-lg leading-none transition-colors hover:bg-accent ${
                    active ? 'bg-primary/10 ring-1 ring-primary' : ''
                  }`}
                  aria-label={t('reactWith', { emoji })}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {reactedEmojis.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reactedEmojis.map((emoji) => (
            <span
              key={emoji}
              className={`inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground ${
                size === 'compact' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs'
              }`}
            >
              <span>{emoji}</span>
              <span>{reactionCounts[emoji]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AnnouncementCard({
  item,
  canManage,
  canEditOwn = true,
  variant = 'default',
  currentUserId,
  departmentOptions,
  userOptions,
  categories,
  mentionOptionsByChannel,
}: AnnouncementCardProps) {
  const t = useTranslations('announcements')
  const locale = useLocale()
  const [expanded, setExpanded] = React.useState(false)
  const [showComments, setShowComments] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [commentInput, setCommentInput] = React.useState('')
  const [commentMentions, setCommentMentions] = React.useState<AnnouncementEditorMention[]>([])
  const [commentAttachments, setCommentAttachments] = React.useState<MultiFileUploadValue[]>([])
  const [submittingComment, setSubmittingComment] = React.useState(false)
  const bodyRef = React.useRef<HTMLParagraphElement>(null)
  const commentEditorRef = React.useRef<AnnouncementRichTextEditorHandle>(null)
  const [clamped, setClamped] = React.useState(false)
  const canEdit = canEditOwn && item.createdById === currentUserId
  const commentMentionOptions = mentionOptionsByChannel[item.categoryId || ''] || []
  const pinnedVariant = variant === 'pinned'
  const announcementDomId = `announcement-${item.id}`
  const commentsHash = `#${announcementDomId}-comments`

  React.useEffect(() => {
    const el = bodyRef.current
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight)
    }
  }, [item.body])

  React.useEffect(() => {
    if (pinnedVariant) return

    function openComments() {
      setShowComments(true)
      window.requestAnimationFrame(() => {
        document.getElementById(announcementDomId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }

    function handleHash() {
      if (window.location.hash === commentsHash) {
        openComments()
      }
    }

    function handleOpenEvent(event: Event) {
      const customEvent = event as CustomEvent<{ id?: string }>
      if (customEvent.detail?.id === item.id) {
        openComments()
      }
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener(OPEN_COMMENTS_EVENT, handleOpenEvent)

    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener(OPEN_COMMENTS_EVENT, handleOpenEvent)
    }
  }, [announcementDomId, commentsHash, item.id, pinnedVariant])

  function handleCommentButtonClick() {
    if (!pinnedVariant) {
      setShowComments((v) => !v)
      return
    }

    window.history.replaceState(null, '', commentsHash)
    window.dispatchEvent(new CustomEvent(OPEN_COMMENTS_EVENT, { detail: { id: item.id } }))
  }

  async function handleReaction(emoji: string) {
    const formData = new FormData()
    formData.set('announcementId', item.id)
    formData.set('emoji', emoji)
    await toggleReactionAction(formData)
  }

  async function handleCommentReaction(commentId: string, emoji: string) {
    const formData = new FormData()
    formData.set('commentId', commentId)
    formData.set('emoji', emoji)
    await toggleCommentReactionAction(formData)
  }

  async function handleComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!commentInput.trim()) return
    setSubmittingComment(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('announcementId', item.id)
      formData.set('body', commentInput.trim())
      formData.delete('mentionedUserIds')
      commentMentions.forEach((mention) => {
        formData.append('mentionedUserIds', mention.id)
      })
      await addCommentAction(formData)
      setCommentInput('')
      setCommentMentions([])
      setCommentAttachments([])
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handlePin() {
    const formData = new FormData()
    formData.set('id', item.id)
    formData.set('pinned', String(!item.pinned))
    await pinAnnouncementAction(formData)
  }

  return (
    <>
      <Card id={pinnedVariant ? undefined : announcementDomId}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <AuthorAvatar name={item.creatorName} photo={item.creatorPhoto} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{item.creatorName}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.sentAt, locale)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!pinnedVariant && item.categoryName && (
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: item.categoryColor ?? undefined, color: '#fff' }}
                  className="text-xs"
                >
                  {item.categoryName}
                </Badge>
              )}
              {item.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
              {(canManage || canEdit) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManage && (
                      <DropdownMenuItem onClick={handlePin}>
                        {item.pinned ? (
                          <>
                            <PinOff className="h-4 w-4 mr-2" />
                            {t('unpin')}
                          </>
                        ) : (
                          <>
                            <Pin className="h-4 w-4 mr-2" />
                            {t('pin')}
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          setEditOpen(true)
                        }}
                      >
                        {t('edit')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {pinnedVariant && item.categoryName && (
            <div>
              <Badge
                variant="secondary"
                style={{ backgroundColor: item.categoryColor ?? undefined, color: '#fff' }}
                className="text-xs"
              >
                {item.categoryName}
              </Badge>
            </div>
          )}

          {/* Title */}
          <h3 className="font-semibold text-base leading-snug">{item.title}</h3>

          {/* Body */}
          <div>
            <p
              ref={bodyRef}
              className={`text-sm text-muted-foreground whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}
            >
              {item.body}
            </p>
            {(clamped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-black hover:underline"
              >
                {expanded ? t('seeLess') : t('seeMore')}
              </button>
            )}
          </div>

          {item.attachments.length > 0 && (
            <div className="grid gap-2">
              {item.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatFileSize(attachment.filesize)}
                  </span>
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <ReactionButtons
              reactionCounts={item.reactionCounts}
              myReactions={item.myReactions}
              onReact={handleReaction}
            />

            <button
              type="button"
              onClick={handleCommentButtonClick}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {item.commentCount > 0
                ? t('commentCount', { count: item.commentCount })
                : t('addComment')}
            </button>
          </div>

          {/* Comments section */}
          {!pinnedVariant && showComments && (
            <div className="space-y-3 border-t pt-3 mx-6 ">
              {item.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-start gap-3">
                    <AuthorAvatar name={comment.authorName} photo={comment.authorPhoto} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {comment.authorName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(comment.createdAt, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pl-12">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {comment.body}
                    </p>
                    {comment.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comment.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-56 items-center gap-2 rounded-full border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate">{attachment.filename}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {formatFileSize(attachment.filesize)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                    <ReactionButtons
                      reactionCounts={comment.reactionCounts}
                      myReactions={comment.myReactions}
                      onReact={(emoji) => handleCommentReaction(comment.id, emoji)}
                      size="compact"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-3">
                <p className="mb-2 text-sm font-semibold">{t('leaveComment')}</p>
                <form onSubmit={handleComment} className="space-y-2">
                  <AnnouncementRichTextEditor
                    ref={commentEditorRef}
                    value={commentInput}
                    mentions={commentMentions}
                    mentionOptions={commentMentionOptions}
                    onChange={(nextBody, nextMentions) => {
                      setCommentInput(nextBody)
                      setCommentMentions(nextMentions)
                    }}
                    className="min-h-16"
                  />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-start gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => commentEditorRef.current?.openMention()}
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
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => commentEditorRef.current?.insertEmoji(emoji)}
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
                        value={commentAttachments}
                        onChange={setCommentAttachments}
                        maxFiles={6}
                        compactTrigger
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submittingComment || !commentInput.trim()}
                    >
                      {t('post')}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <AnnouncementComposeDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          announcement={item}
          departmentOptions={departmentOptions}
          userOptions={userOptions}
          categories={categories}
          mentionOptionsByChannel={mentionOptionsByChannel}
        />
      )}
    </>
  )
}
