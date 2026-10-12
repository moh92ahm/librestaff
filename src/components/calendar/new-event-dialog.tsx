'use client'

import * as React from 'react'
import { CalendarIcon, CalendarPlus, Plus, Trash2 } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { useLocale, useTranslations } from 'next-intl'
import { createCalendarEventAction, deleteCalendarEventAction } from '@/lib/actions/events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
import { TargetFields, type TargetOption } from '@/components/communications/target-fields'
import type { CalendarEvent } from '@/components/calendar/calendar'
import { TimezoneSelect } from '@/components/ui/timezone-select'
import { getDateFnsLocale } from '@/i18n/config'

interface EventDialogProps {
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  event?: CalendarEvent | null
  defaultTimezone: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface NewEventDialogProps {
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  defaultTimezone: string
}

type EditableEventStatus = 'new' | 'cancelled'

function normalizeEventStatus(status?: string): 'new' | 'held' | 'cancelled' {
  if (status === 'held' || status === 'cancelled') return status
  return 'new'
}

function formatDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function defaultStartDate() {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1)
  return date
}

function defaultEndDate(start: Date) {
  const date = new Date(start)
  date.setHours(date.getHours() + 1)
  return date
}

function combineDateAndTime(date: Date, time: string, endOfAllDay = false) {
  if (endOfAllDay) {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    return `${formatDateValue(nextDate)}T00:00`
  }

  return `${formatDateValue(date)}T${time}`
}

function getAllDayDisplayEnd(date: Date) {
  const result = new Date(date)
  result.setDate(result.getDate() - 1)
  return result
}

function formatDisplayDate(date: Date | undefined, locale: string, fallback: string) {
  if (!date) return fallback

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatDisplayRange(range: DateRange, locale: string, selectDate: string, selectDates: string) {
  if (!range.from) return selectDates
  if (!range.to || formatDateValue(range.from) === formatDateValue(range.to)) {
    return formatDisplayDate(range.from, locale, selectDate)
  }

  return `${formatDisplayDate(range.from, locale, selectDate)} - ${formatDisplayDate(
    range.to,
    locale,
    selectDate,
  )}`
}

export function EventDialog({
  departmentOptions,
  userOptions,
  event,
  defaultTimezone,
  open,
  onOpenChange,
}: EventDialogProps) {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const datePickerLocale = getDateFnsLocale(locale)
  const isEdit = Boolean(event?.id)
  const initialStart = event?.start ? new Date(event.start) : defaultStartDate()
  const initialEnd = event?.end ? new Date(event.end) : defaultEndDate(initialStart)
  const initialAllDayEnd = event?.allDay ? getAllDayDisplayEnd(initialEnd) : initialEnd
  const [selectedRange, setSelectedRange] = React.useState<DateRange>({
    from: initialStart,
    to: initialAllDayEnd,
  })
  const [startTime, setStartTime] = React.useState(formatTimeValue(initialStart))
  const [endTime, setEndTime] = React.useState(formatTimeValue(initialEnd))
  const [allDay, setAllDay] = React.useState(event?.allDay || false)
  const [timezone, setTimezone] = React.useState(event?.timezone || defaultTimezone)
  const [eventStatus, setEventStatus] = React.useState<EditableEventStatus>(
    normalizeEventStatus(event?.status) === 'cancelled' ? 'cancelled' : 'new',
  )
  const normalizedStatus = normalizeEventStatus(event?.status)
  const canEdit = !event?.id || normalizedStatus === 'new'

  React.useEffect(() => {
    const nextStart = event?.start ? new Date(event.start) : defaultStartDate()
    const nextEnd = event?.end ? new Date(event.end) : defaultEndDate(nextStart)
    setSelectedRange({
      from: nextStart,
      to: event?.allDay ? getAllDayDisplayEnd(nextEnd) : nextEnd,
    })
    setStartTime(formatTimeValue(nextStart))
    setEndTime(formatTimeValue(nextEnd))
    setAllDay(event?.allDay || false)
    setTimezone(event?.timezone || defaultTimezone)
    setEventStatus(normalizeEventStatus(event?.status) === 'cancelled' ? 'cancelled' : 'new')
  }, [event, defaultTimezone])

  const startDate = selectedRange.from || initialStart
  const endDate = selectedRange.to || selectedRange.from || initialStart

  const content = (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <form key={event?.id || 'new-event'} action={createCalendarEventAction} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editEvent') : t('newEvent')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('editEventDescription') : t('newEventDescription')}
          </DialogDescription>
        </DialogHeader>

        {event?.id && <input type="hidden" name="id" value={event.id} />}
        <input
          type="hidden"
          name="startAt"
          value={combineDateAndTime(startDate, allDay ? '00:00' : startTime)}
        />
        <input
          type="hidden"
          name="endAt"
          value={
            allDay
              ? combineDateAndTime(endDate, '00:00', true)
              : combineDateAndTime(endDate, endTime)
          }
        />
        <input type="hidden" name="allDay" value={allDay ? 'on' : 'off'} />
        {!allDay && <input type="hidden" name="timezone" value={timezone} />}
        <input type="hidden" name="eventStatus" value={canEdit ? eventStatus : normalizedStatus} />

        <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={isEdit ? `event-title-${event?.id}` : 'event-title'}>
                {t('eventTitle')}
              </Label>
              <Input
                id={isEdit ? `event-title-${event?.id}` : 'event-title'}
                name="title"
                defaultValue={event?.title || ''}
                maxLength={255}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={isEdit ? `event-description-${event?.id}` : 'event-description'}>
                {t('eventDescription')}
              </Label>
              <Textarea
                id={isEdit ? `event-description-${event?.id}` : 'event-description'}
                name="description"
                defaultValue={event?.description || ''}
                rows={4}
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('dateRange')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start"
                    disabled={!canEdit}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {formatDisplayRange(
                      selectedRange,
                      locale,
                      t('selectDate'),
                      t('selectDates'),
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    locale={datePickerLocale}
                    selected={selectedRange}
                    onSelect={(range) => {
                      if (range) setSelectedRange(range)
                    }}
                    numberOfMonths={2}
                    disabled={!canEdit}
                    required
                  />
                </PopoverContent>
              </Popover>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allDay}
                disabled={!canEdit}
                onChange={(event) => setAllDay(event.target.checked)}
                className="border-input size-4 rounded-sm border"
              />
              {t('allDayEvent')}
            </label>

            {!allDay && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor={isEdit ? `event-start-time-${event?.id}` : 'event-start-time'}>
                    {t('from')}
                  </Label>
                  <TimePicker
                    id={isEdit ? `event-start-time-${event?.id}` : 'event-start-time'}
                    value={startTime}
                    onChange={(newTime) => {
                      setStartTime(newTime)
                      if (
                        formatDateValue(startDate) === formatDateValue(endDate) &&
                        newTime >= endTime
                      ) {
                        const [h, m] = newTime.split(':').map(Number)
                        const nextEnd = new Date(startDate)
                        nextEnd.setHours(h + 1, m, 0, 0)
                        setEndTime(formatTimeValue(nextEnd))
                        if (nextEnd.getDate() !== startDate.getDate()) {
                          setSelectedRange((prev) => ({ ...prev, to: nextEnd }))
                        }
                      }
                    }}
                    disabled={!canEdit}
                    placeholder={t('from')}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={isEdit ? `event-end-time-${event?.id}` : 'event-end-time'}>
                    {t('to')}
                  </Label>
                  <TimePicker
                    id={isEdit ? `event-end-time-${event?.id}` : 'event-end-time'}
                    value={endTime}
                    onChange={setEndTime}
                    disabled={!canEdit}
                    placeholder={t('to')}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={isEdit ? `event-timezone-${event?.id}` : 'event-timezone'}>
                    {t('timezone')}
                  </Label>
                  <TimezoneSelect
                    id={isEdit ? `event-timezone-${event?.id}` : 'event-timezone'}
                    value={timezone}
                    onValueChange={setTimezone}
                    disabled={!canEdit}
                    placeholder={t('timezone')}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={isEdit ? `event-location-${event?.id}` : 'event-location'}>
                  {t('location')}
                </Label>
                <Input
                  id={isEdit ? `event-location-${event?.id}` : 'event-location'}
                  name="location"
                  defaultValue={event?.location || ''}
                  maxLength={255}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <TargetFields
              targetType={event?.targetType || 'everyone'}
              departmentOptions={departmentOptions}
              userOptions={userOptions}
              selectedDepartmentIds={event?.departmentIds || []}
              selectedUserIds={event?.userIds || []}
              disabled={!canEdit}
            />
          </div>

        <DialogFooter className="flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isEdit && (
              canEdit ? (
                <Select
                  value={eventStatus}
                  onValueChange={(value) => setEventStatus(value as EditableEventStatus)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t('status.new')}</SelectItem>
                    <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Badge
                    variant={normalizedStatus === 'cancelled' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {t(`status.${normalizedStatus}`)}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {normalizedStatus === 'held'
                      ? t('lockedAfterTimePassed')
                      : t('cancelledEventsLocked')}
                  </p>
                </>
              )
            )}
          </div>

          <div className="flex gap-2">
            {isEdit && (
              <Button type="submit" variant="destructive" formAction={deleteCalendarEventAction}>
                <Trash2 className="h-4 w-4" />
                {t('deleteEvent')}
              </Button>
            )}
            <Button type="submit" disabled={!canEdit}>
              <CalendarPlus className="h-4 w-4" />
              {isEdit ? t('saveChanges') : t('publishEvent')}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  )

  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {content}
      </Dialog>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="h-4 w-4" />
          {t('newEvent')}
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  )
}

export function NewEventDialog({
  departmentOptions,
  userOptions,
  defaultTimezone,
}: NewEventDialogProps) {
  return (
    <EventDialog
      departmentOptions={departmentOptions}
      userOptions={userOptions}
      defaultTimezone={defaultTimezone}
    />
  )
}
