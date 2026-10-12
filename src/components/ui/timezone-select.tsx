'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatTimeZoneLabel, getTimeZoneOptions } from '@/lib/timezones'
import { useTranslations } from 'next-intl'

interface TimezoneSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function TimezoneSelect({
  id,
  value,
  onValueChange,
  disabled,
  placeholder,
}: TimezoneSelectProps) {
  const t = useTranslations('common')
  const timeZoneOptions = React.useMemo(() => getTimeZoneOptions(value), [value])

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder || t('selectTimezone')} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {timeZoneOptions.map((timeZone) => (
          <SelectItem key={timeZone} value={timeZone}>
            {formatTimeZoneLabel(timeZone)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
