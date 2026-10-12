'use client'

import * as React from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { saveCategoryAction } from '@/lib/actions/announcement-feed'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiTargetPicker, type TargetOption } from '@/components/communications/target-fields'

const PRESET_COLORS = [
  { value: '#818cf8', labelKey: 'indigo' },
  { value: '#a78bfa', labelKey: 'violet' },
  { value: '#fb7185', labelKey: 'rose' },
  { value: '#34d399', labelKey: 'emerald' },
  { value: '#fbbf24', labelKey: 'amber' },
  { value: '#94a3b8', labelKey: 'slate' },
]

export type AnnouncementChannelFormValue = {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
}

export function isGeneralChannel(channel: Pick<AnnouncementChannelFormValue, 'name'>) {
  return channel.name.trim().toLowerCase() === 'general'
}

function ColorSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  const t = useTranslations('announcements')

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRESET_COLORS.map((color) => (
          <SelectItem key={color.value} value={color.value}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: color.value }}
              />
              {t(`colors.${color.labelKey}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AnnouncementChannelForm({
  channel,
  departmentOptions,
  userOptions,
  cancelHref,
  redirectTo,
  submitLabel,
  onCancel,
  onSubmitted,
}: {
  channel?: AnnouncementChannelFormValue
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  cancelHref?: string
  redirectTo?: string
  submitLabel?: string
  onCancel?: () => void
  onSubmitted?: () => void
}) {
  const t = useTranslations('announcements')
  const targetT = useTranslations('targetFields')
  const [color, setColor] = React.useState(channel?.color || PRESET_COLORS[0].value)
  const [visibility, setVisibility] = React.useState<'public' | 'private'>(
    channel?.visibility || 'public',
  )
  const [departmentIds, setDepartmentIds] = React.useState(channel?.departmentIds || [])
  const [userIds, setUserIds] = React.useState(channel?.userIds || [])
  const isGeneral = channel ? isGeneralChannel(channel) : false
  const filteredUserOptions = React.useMemo(() => {
    if (departmentIds.length === 0) return userOptions

    const selectedDepartments = new Set(departmentIds)
    return userOptions.filter((option) =>
      option.departmentIds?.some((departmentId) => selectedDepartments.has(departmentId)),
    )
  }, [departmentIds, userOptions])

  React.useEffect(() => {
    if (visibility !== 'private' || departmentIds.length === 0) return

    const departmentUserIds = filteredUserOptions.map((option) => option.value)
    const allowedIds = new Set(departmentUserIds)
    setUserIds((current) =>
      Array.from(
        new Set([...current.filter((userId) => allowedIds.has(userId)), ...departmentUserIds]),
      ),
    )
  }, [departmentIds.length, filteredUserOptions, visibility])

  async function handleSubmit(formData: FormData) {
    await saveCategoryAction(formData)
    onSubmitted?.()
  }

  return (
    <form
      action={onSubmitted ? handleSubmit : saveCategoryAction}
      className="space-y-4 rounded-md border p-4"
    >
      {channel?.id && <input type="hidden" name="id" value={channel.id} />}
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="visibility" value={visibility} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <div className="grid gap-4 md:grid-cols-[160px_1fr_180px]">
        <div className="grid gap-2">
          <Label>{t('color')}</Label>
          <ColorSelect value={color} onValueChange={setColor} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={channel ? `channel-name-${channel.id}` : 'channel-name'}>
            {t('name')}
          </Label>
          <Input
            id={channel ? `channel-name-${channel.id}` : 'channel-name'}
            name="name"
            defaultValue={channel?.name || ''}
            maxLength={100}
            disabled={isGeneral}
            placeholder={t('namePlaceholder')}
            required
          />
          {isGeneral && channel && <input type="hidden" name="name" value={channel.name} />}
        </div>
        <div className="grid gap-2">
          <Label>{t('visibility')}</Label>
          <Select
            value={visibility}
            onValueChange={(value) => setVisibility(value === 'private' ? 'private' : 'public')}
            disabled={isGeneral}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t('public')}</SelectItem>
              <SelectItem value="private">{t('privateLabel')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibility === 'private' && (
        <div className="grid gap-4 md:grid-cols-2">
          <MultiTargetPicker
            name="departmentIds"
            label={targetT('departments')}
            options={departmentOptions}
            selectedValues={departmentIds}
            onChange={setDepartmentIds}
            placeholder={targetT('selectDepartments')}
            searchPlaceholder={targetT('searchDepartments')}
            emptyMessage={targetT('noDepartmentsFound')}
          />
          <MultiTargetPicker
            name="userIds"
            label={targetT('people')}
            options={filteredUserOptions}
            selectedValues={userIds}
            onChange={setUserIds}
            placeholder={
              departmentIds.length > 0
                ? t('searchPeopleInSelectedDepartments')
                : targetT('searchAndSelectPeople')
            }
            searchPlaceholder={targetT('searchPeople')}
            emptyMessage={
              departmentIds.length > 0
                ? t('noPeopleInSelectedDepartments')
                : targetT('noPeopleFound')
            }
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {cancelHref && (
          <Button type="button" variant="ghost" asChild>
            <Link href={cancelHref}>
              <X className="h-4 w-4" />
              {t('cancel')}
            </Link>
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
            {t('cancel')}
          </Button>
        )}
        <Button type="submit">
          {submitLabel || (channel ? t('saveChannel') : t('addChannel'))}
        </Button>
      </div>
    </form>
  )
}
