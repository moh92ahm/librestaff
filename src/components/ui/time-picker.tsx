'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'

type TimePickerProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  stepMinutes?: number
  placeholder?: string
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatTimeLabel(value: string) {
  const [hourValue, minuteValue] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hourValue || 0, minuteValue || 0, 0, 0)

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function TimePicker({
  value,
  onChange,
  disabled = false,
  id,
  stepMinutes = 15,
  placeholder,
}: TimePickerProps) {
  const t = useTranslations('common')
  const options = React.useMemo(() => {
    const values: string[] = []
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += stepMinutes) {
        values.push(formatTime(hour, minute))
      }
    }
    return values
  }, [stepMinutes])

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder || t('selectTime')} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {formatTimeLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
