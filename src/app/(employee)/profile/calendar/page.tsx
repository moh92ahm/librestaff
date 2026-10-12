import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import EventCalendar from '@/components/calendar/calendar'
import { getCompanyHolidayCountries } from '@/lib/company-holidays'
import { getPublicHolidayEvents } from '@/lib/holiday-utils'
import { requireAuth } from '@/lib/auth-guards'
import {
  getVisibleApprovedLeaveCalendarEvents,
  getVisiblePublishedEventCalendarEvents,
} from '@/lib/events'
import type { User } from '@/lib/rbac'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'My Calendar',
}

export default async function ProfileCalendarPage() {
  const user = (await requireAuth()) as User
  const [holidayCountries, publishedEvents, approvedLeaveEvents] = await Promise.all([
    getCompanyHolidayCountries(),
    getVisiblePublishedEventCalendarEvents(user),
    getVisibleApprovedLeaveCalendarEvents(user),
  ])

  const events = [
    ...publishedEvents,
    ...approvedLeaveEvents,
    ...getPublicHolidayEvents(holidayCountries),
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Calendar</h1>
          <p className="text-muted-foreground">Events and holidays visible to you.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/me">
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
        </Button>
      </div>
      <EventCalendar events={events} />
    </div>
  )
}
