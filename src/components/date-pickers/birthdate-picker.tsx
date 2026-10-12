'use client'
import { DatePicker } from '@/components/date-picker'

interface BirthdatePickerProps {
  value?: string
  label?: string
  onValueChange?: (value: string) => void
  name?: string
  error?: string
}

export function BirthdatePicker({ label = 'Date of Birth', ...props }: BirthdatePickerProps) {
  return (
    <DatePicker
      {...props}
      label={label}
      allowFuture={false}
      yearRange={{ from: 1940, to: new Date().getFullYear() }}
    />
  )
}
