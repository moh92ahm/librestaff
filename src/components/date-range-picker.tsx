'use client'

import * as React from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getDateFnsLocale } from '@/i18n/config'
import { formatDate, formatDateForInput, parseDate } from '@/lib/date-utils'

interface DateRangePickerProps {
  startValue?: string
  endValue?: string
  label: string
  startName?: string
  endName?: string
  onStartValueChange?: (value: string) => void
  onEndValueChange?: (value: string) => void
  error?: string
  disabled?: boolean
}

export function DateRangePicker({
  startValue,
  endValue,
  label,
  startName,
  endName,
  onStartValueChange,
  onEndValueChange,
  error,
  disabled = false,
}: DateRangePickerProps) {
  const locale = useLocale()
  const commonT = useTranslations('common')
  const calendarLocale = getDateFnsLocale(locale)
  const date = React.useMemo<DateRange | undefined>(() => {
    const from = parseDate(startValue)
    const to = parseDate(endValue)

    if (!from && !to) return undefined
    return { from, to }
  }, [endValue, startValue])

  const handleSelect = (range?: DateRange) => {
    if (range?.from) {
      onStartValueChange?.(formatDateForInput(range.from))
    } else {
      onStartValueChange?.('')
    }

    if (range?.to) {
      onEndValueChange?.(formatDateForInput(range.to))
    } else {
      onEndValueChange?.('')
    }
  }

  return (
    <Field className="md:col-span-1" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor="date-picker-range" className="px-1">
        {label}
      </FieldLabel>
      <input type="hidden" name={startName} value={startValue ?? ''} />
      <input type="hidden" name={endName} value={endValue ?? ''} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={error ? 'destructive' : 'outline'}
            id="date-picker-range"
            type="button"
            className="justify-start px-0 font-normal"
            disabled={disabled}
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {formatDate(date.from, locale)} - {formatDate(date.to, locale)}
                </>
              ) : (
                formatDate(date.from, locale)
              )
            ) : (
              <span>{commonT('selectDate')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={calendarLocale}
          />
        </PopoverContent>
      </Popover>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
