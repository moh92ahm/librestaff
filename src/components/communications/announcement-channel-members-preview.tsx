'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type AnnouncementChannelMemberPreviewValue = {
  channelId: string
  channelName: string
  members: Array<{
    id: string
    fullName: string
    photo: string | null
    jobTitle: string | null
    departmentNames: string[]
  }>
}

const COMPACT_MEMBER_LIMIT = 12

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function memberDetail(
  member: AnnouncementChannelMemberPreviewValue['members'][number],
  noTitle: string,
  noDepartment: string,
) {
  const title = member.jobTitle?.trim() || noTitle
  const departments =
    member.departmentNames.length > 0 ? member.departmentNames.join(', ') : noDepartment

  return `${title} - ${departments}`
}

function MemberAvatar({
  member,
  compact = false,
}: {
  member: AnnouncementChannelMemberPreviewValue['members'][number]
  compact?: boolean
}) {
  const t = useTranslations('announcements')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar
          className={cn(
            'border-2 border-background bg-muted',
            compact ? 'size-8' : 'size-9',
          )}
        >
          <AvatarImage src={member.photo || undefined} alt={member.fullName} className="object-cover" />
          <AvatarFallback className="text-[11px] font-medium">
            {initials(member.fullName)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-64 text-left">
        {compact ? (
          <div className="grid gap-0.5">
            <p className="font-medium">{member.fullName}</p>
            <p className="text-background/80">
              {memberDetail(member, t('noTitle'), t('noDepartment'))}
            </p>
          </div>
        ) : (
          <span>{member.fullName}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function AnnouncementChannelMembersPreview({
  preview,
}: {
  preview: AnnouncementChannelMemberPreviewValue | null
}) {
  const t = useTranslations('announcements')
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    setExpanded(false)
  }, [preview?.channelId])

  if (!preview) return null

  const compactMembers = preview.members.slice(0, COMPACT_MEMBER_LIMIT)
  const overflowCount = Math.max(0, preview.members.length - COMPACT_MEMBER_LIMIT)

  return (
    <section className="rounded-lg border bg-background px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {t('membersTitle', { name: preview.channelName })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('memberCount', { count: preview.members.length })}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-center">
          {compactMembers.length > 0 ? (
            <div className="-space-x-2 flex min-w-0 items-center">
              {compactMembers.map((member) => (
                <MemberAvatar key={member.id} member={member} compact />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noMembers')}</p>
          )}
          {overflowCount > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-2 h-8 rounded-full px-2.5 text-xs"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              +{overflowCount}
            </Button>
          )}
        </div>
      </div>

      {expanded && preview.members.length > COMPACT_MEMBER_LIMIT && (
        <div className="mt-3 flex flex-wrap" style={{ gap: 5 }}>
          {preview.members.map((member) => (
            <MemberAvatar key={member.id} member={member} />
          ))}
        </div>
      )}
    </section>
  )
}
