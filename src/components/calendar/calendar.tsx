'use client'

import moment from 'moment'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar as BigCalendar,
  momentLocalizer,
  type CalendarProps,
  type NavigateAction,
  type ToolbarProps,
  type View,
} from 'react-big-calendar'
import type { EventProps } from 'react-big-calendar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocale, useTranslations } from 'next-intl'
import { EventDialog, NewEventDialog } from '@/components/calendar/new-event-dialog'
import {
  allCalendarEventTypes,
  CalendarTypeFilter,
  type CalendarEventType,
} from '@/components/calendar/calendar-type-filter'
import type { TargetOption } from '@/components/communications/target-fields'
import { getCalendarDisplayEnd, normalizeCalendarEventDateRange } from '@/lib/calendar-event-dates'
import { getCalendarCulture } from '@/i18n/config'
import './shadcn-big-calendar/shadcn-big-calendar.css'

export interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  start: Date
  end: Date
  startDate?: string
  endDate?: string
  userId?: string
  avatar?: string
  birthDate?: Date
  age?: number
  type?: 'birthday' | 'event' | 'holiday' | 'leave' | 'anniversary'
  allDay?: boolean
  status?: 'draft' | 'published' | 'new' | 'held' | 'cancelled'
  targetType?: 'everyone' | 'departments' | 'users'
  departmentIds?: string[]
  userIds?: string[]
  timezone?: string
  location?: string | null
  linkUrl?: string
}

type ShadcnCalendarEvent = CalendarEvent

interface EventCalendarProps {
  events: CalendarEvent[]
  canCreateEvent?: boolean
  departmentOptions?: TargetOption[]
  userOptions?: TargetOption[]
  defaultTimezone?: string
}

const localizer = momentLocalizer(moment)
function formatEventTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function EventCell({ event }: EventProps<ShadcnCalendarEvent>) {
  const locale = useLocale()
  const timeLabel = event.allDay
    ? null
    : `${formatEventTime(event.start, locale)} – ${formatEventTime(event.end, locale)}`

  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="truncate">{event.title}</span>
      {event.description && (
        <span className="truncate text-[0.85rem] opacity-75">{event.description}</span>
      )}
      {timeLabel && <span className="truncate text-[0.75rem] opacity-75">{timeLabel}</span>}
    </div>
  )
}

function AgendaEventCell({ event }: EventProps<ShadcnCalendarEvent>) {
  return (
    <div className="min-w-0 whitespace-normal">
      <div className="break-words text-sm font-medium">{event.title}</div>
      {event.description && (
        <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
          {event.description}
        </div>
      )}
      {event.location && (
        <div className="mt-1 break-words text-xs text-muted-foreground">{event.location}</div>
      )}
    </div>
  )
}

function MonthEventCell({ event }: EventProps<ShadcnCalendarEvent>) {
  const compactTitle = (() => {
    if (event.type === 'birthday' || event.type === 'anniversary') {
      const icon = event.type === 'birthday' ? '🎂' : '🎉'
      const name = event.title
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/\s+\([^)]*\)$/, '')
        .trim()
        .split(/\s+/)[0]
      return `${icon} ${name || event.title}`
    }

    if (event.type === 'leave') {
      return event.title.split(' - ')[0] || event.title
    }

    return event.title
  })()

  return (
    <>
      <strong className="block truncate font-medium md:hidden">{compactTitle}</strong>
      <em className="hidden truncate not-italic md:block">{event.title}</em>
    </>
  )
}

const calendarViews: View[] = ['month', 'week', 'day', 'agenda']

function CompactCalendarToolbar({
  date,
  label,
  view,
  onNavigate,
  onView,
}: ToolbarProps<ShadcnCalendarEvent>) {
  const t = useTranslations('calendar.toolbar')
  const locale = useLocale()
  const viewLabels: Record<View, string> = {
    month: t('month'),
    week: t('week'),
    work_week: t('week'),
    day: t('day'),
    agenda: t('agenda'),
  }
  const shortViewLabels: Record<View, string> = {
    month: t('monthShort'),
    week: t('weekShort'),
    work_week: t('weekShort'),
    day: t('dayShort'),
    agenda: t('agendaShort'),
  }
  const displayLabel =
    view === 'agenda'
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
      : label

  return (
    <div className="calendar-compact-toolbar flex items-center gap-1 border-b px-1.5 py-2 sm:gap-2 sm:px-3">
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onNavigate('PREV')}
          aria-label={t('previous')}
          title={t('previous')}
          className="size-7 sm:size-8"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
          className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
        >
          {t('today')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onNavigate('NEXT')}
          aria-label={t('next')}
          title={t('next')}
          className="size-7 sm:size-8"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold sm:text-base">
        {displayLabel}
      </span>

      <div className="flex shrink-0 overflow-hidden rounded-lg border">
        {calendarViews.map((calendarView, index) => (
          <Button
            key={calendarView}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onView(calendarView)}
            className={`h-7 min-w-7 rounded-none px-1 text-[11px] sm:h-8 sm:min-w-0 sm:px-3 sm:text-sm ${
              index > 0 ? 'border-l' : ''
            } ${view === calendarView ? 'bg-accent text-accent-foreground' : ''}`}
          >
            <span className="sm:hidden">{shortViewLabels[calendarView]}</span>
            <span className="hidden sm:inline">{viewLabels[calendarView]}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

export default function EventCalendar({
  events,
  canCreateEvent = false,
  departmentOptions = [],
  userOptions = [],
  defaultTimezone = 'UTC',
}: EventCalendarProps) {
  const t = useTranslations('calendar')
  const locale = useLocale()
  const router = useRouter()
  const culture = getCalendarCulture(locale)
  const [selectedTypes, setSelectedTypes] = React.useState<Set<CalendarEventType>>(
    () => new Set(allCalendarEventTypes),
  )
  const [calendarView, setCalendarView] = React.useState<View>('month')
  const [calendarDate, setCalendarDate] = React.useState(() => new Date())
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null)
  const calendarMessages = React.useMemo(
    () => ({
      allDay: t('toolbar.allDay'),
      previous: t('toolbar.previous'),
      next: t('toolbar.next'),
      today: t('toolbar.today'),
      month: t('toolbar.month'),
      week: t('toolbar.week'),
      day: t('toolbar.day'),
      agenda: t('toolbar.agenda'),
      date: t('toolbar.date'),
      time: t('toolbar.time'),
      event: t('toolbar.event'),
      noEventsInRange: t('toolbar.noEventsInRange'),
      showMore: (count: number) => t('toolbar.showMore', { count }),
    }),
    [t],
  )
  const calendarFormats = React.useMemo(
    () => ({
      agendaDateFormat: (date: Date) =>
        new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          month: 'long',
          day: 'numeric',
        }).format(date),
    }),
    [locale],
  )
  const visibleEvents = React.useMemo(
    () => events.filter((event) => !event.type || selectedTypes.has(event.type)),
    [events, selectedTypes],
  )
  const normalizedEvents: ShadcnCalendarEvent[] = visibleEvents.map((event) =>
    normalizeCalendarEventDateRange(event),
  )
  const calendarEvents: ShadcnCalendarEvent[] = normalizedEvents.map((event) => ({
    ...event,
    end: getCalendarDisplayEnd(event),
  }))

  const eventPropGetter: CalendarProps<ShadcnCalendarEvent>['eventPropGetter'] = (event) => {
    const variant =
      event.type === 'birthday'
        ? 'primary'
        : event.type === 'anniversary'
          ? 'primary'
          : event.type === 'holiday'
            ? 'secondary'
            : event.type === 'leave'
              ? 'secondary'
              : 'outline'

    return {
      className: `event-variant-${variant} ${
        event.status === 'cancelled' ? 'opacity-60 line-through' : ''
      }`,
    }
  }

  const handleSelectEvent: CalendarProps<ShadcnCalendarEvent>['onSelectEvent'] = (event) => {
    if (event.linkUrl) {
      router.push(event.linkUrl)
      return
    }
    if (!canCreateEvent || event.type !== 'event') return
    setEditingEvent(normalizedEvents.find((item) => item.id === event.id) ?? event)
  }

  const toggleEventType = (type: CalendarEventType) => {
    setSelectedTypes((current) => {
      if (current.has(type) && current.size === 1) return current
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleViewChange = (nextView: View) => {
    if (nextView === 'agenda' && calendarView !== 'agenda') {
      setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth(), 1))
    }
    setCalendarView(nextView)
  }

  const handleNavigate = (nextDate: Date, view: View, action: NavigateAction) => {
    if (view === 'agenda') {
      if (action === 'NEXT') {
        setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
        return
      }
      if (action === 'PREV') {
        setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
        return
      }
      if (action === 'TODAY') {
        const today = new Date()
        setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1))
        return
      }
    }

    setCalendarDate(nextDate)
  }

  const agendaLength = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    0,
  ).getDate()

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <CalendarTypeFilter
            selectedTypes={selectedTypes}
            onToggle={toggleEventType}
            onSelectAll={() => setSelectedTypes(new Set(allCalendarEventTypes))}
          />
          {canCreateEvent && (
            <NewEventDialog
              departmentOptions={departmentOptions}
              userOptions={userOptions}
              defaultTimezone={defaultTimezone}
            />
          )}
        </div>
        {canCreateEvent && (
          <EventDialog
            open={Boolean(editingEvent)}
            onOpenChange={(open) => {
              if (!open) setEditingEvent(null)
            }}
            event={editingEvent}
            departmentOptions={departmentOptions}
            userOptions={userOptions}
            defaultTimezone={defaultTimezone}
          />
        )}
        <BigCalendar<ShadcnCalendarEvent>
          localizer={localizer}
          culture={culture}
          messages={calendarMessages}
          formats={calendarFormats}
          events={calendarEvents}
          date={calendarDate}
          view={calendarView}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          length={agendaLength}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          components={{
            toolbar: CompactCalendarToolbar,
            event: EventCell,
            agenda: { event: AgendaEventCell },
            month: { event: MonthEventCell },
          }}
          eventPropGetter={eventPropGetter}
          onSelectEvent={handleSelectEvent}
          defaultView="month"
          views={calendarViews}
          popup
          showMultiDayTimes={false}
          drilldownView="day"
          style={{ height: '72vh', minHeight: 620 }}
          className={`calendar-view-${calendarView} border-border border-solid`}
        />
      </CardContent>
    </Card>
  )
}
