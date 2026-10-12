'use client'
import * as React from 'react'
import { ChevronDownIcon, XIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getDateFnsLocale } from '@/i18n/config'
import { formatDate, parseDate, formatDateForInput } from '@/lib/date-utils'

interface DatePickerProps {
  value?: string
  label: string
  onValueChange?: (value: string) => void
  name?: string
  error?: string
  defaultToToday?: boolean
  allowPast?: boolean
  allowFuture?: boolean
  yearRange?: { from: number; to: number }
  clearable?: boolean
  disabled?: boolean
}

export function DatePicker({
  value,
  label,
  onValueChange,
  name,
  error,
  defaultToToday = false,
  allowPast = true,
  allowFuture = true,
  yearRange,
  clearable = false,
  disabled = false,
}: DatePickerProps) {
  const locale = useLocale()
  const commonT = useTranslations('common')
  const [open, setOpen] = React.useState(false)
  const calendarLocale = getDateFnsLocale(locale)

  const parsedDate = React.useMemo(() => {
    if (!value && defaultToToday) return new Date()
    if (!value) return undefined
    return parseDate(value)
  }, [value, defaultToToday])

  const [date, setDate] = React.useState<Date | undefined>(parsedDate)

  React.useEffect(() => {
    setDate(parsedDate)
  }, [parsedDate])

  // Initialize with today's date if defaultToToday is true and no value
  React.useEffect(() => {
    if (defaultToToday && !value && onValueChange) {
      const today = formatDateForInput(new Date())
      onValueChange(today)
    }
  }, [defaultToToday, value, onValueChange])

  const isDateDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    if (!allowPast && checkDate < today) return true
    if (!allowFuture && checkDate > today) return true

    return false
  }

  const handleSelect = (d?: Date) => {
    setDate(d)
    if (d && onValueChange) {
      // Use local date calculation to avoid timezone issues
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      onValueChange(`${year}-${month}-${day}`)
    }
    setOpen(false)
  }

  const handleClear = () => {
    setDate(undefined)
    onValueChange?.('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={label} className="px-1">
        {label}
      </Label>
      <input type="hidden" name={name} value={value ?? ''} />
      <Popover open={disabled ? false : open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={error ? 'destructive' : 'outline'}
            id={label}
            className="justify-between font-normal"
            disabled={disabled}
          >
            {date ? formatDate(date, locale) : commonT('selectDate')}
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            onSelect={handleSelect}
            disabled={isDateDisabled}
            fromYear={yearRange?.from}
            toYear={yearRange?.to}
            locale={calendarLocale}
          />
          {clearable && date && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={handleClear}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  )
}
