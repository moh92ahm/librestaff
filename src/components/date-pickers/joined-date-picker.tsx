'use client'
import { DatePicker } from '@/components/date-picker'

interface JoinedDatePickerProps {
  value?: string
  label?: string
  onValueChange?: (value: string) => void
  name?: string
  error?: string
}

export function JoinedDatePicker({ label = 'Joined Date', ...props }: JoinedDatePickerProps) {
  return (
    <DatePicker
      {...props}
      label={label}
      defaultToToday={true}
      yearRange={{ from: 2020, to: new Date().getFullYear() + 1 }}
    />
  )
}
