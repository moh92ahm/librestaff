'use client'
import { DatePicker } from '@/components/date-picker'

interface OfficialStartDatePickerProps {
  value?: string
  label?: string
  onValueChange?: (value: string) => void
  name?: string
  error?: string
}

export function OfficialStartDatePicker({
  label = 'Official Start Date',
  ...props
}: OfficialStartDatePickerProps) {
  return (
    <DatePicker
      {...props}
      label={label}
      clearable={true}
      yearRange={{ from: 1950, to: new Date().getFullYear() + 5 }}
    />
  )
}
