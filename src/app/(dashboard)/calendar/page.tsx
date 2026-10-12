import type { Metadata } from 'next'
import EventCalendar from '@/components/calendar/calendar'
import { transformBirthdaysToEvents, transformWorkAnniversariesToEvents } from '@/lib/calendar-utils'
import { getPublicHolidayEvents } from '@/lib/holiday-utils'
import { getCompanyHolidayCountries } from '@/lib/company-holidays'
import { db } from '@/db'
import { requireAuth } from '@/lib/auth-guards'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { getTranslations } from 'next-intl/server'
import {
  getVisibleApprovedLeaveCalendarEvents,
  getVisiblePublishedEventCalendarEvents,
} from '@/lib/events'
import { isAdmin, type User } from '@/lib/rbac'
import { getCommunicationFormOptions } from '@/lib/communication-options'
import { getOrCreateCompanySettings } from '@/lib/company-settings'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar')

  return {
    title: t('title'),
  }
}

export default async function CalendarPage() {
  const currentUser = (await requireAuth()) as User
  const t = await getTranslations('calendar')

  const [
    users,
    holidayCountries,
    publishedEvents,
    approvedLeaveEvents,
    options,
    companySettings,
  ] = await Promise.all([
    db.query.usersTable.findMany({
      limit: 1000,
    }),
    getCompanyHolidayCountries(),
    getVisiblePublishedEventCalendarEvents(currentUser),
    getVisibleApprovedLeaveCalendarEvents(currentUser),
    getCommunicationFormOptions(),
    getOrCreateCompanySettings(),
  ])

  const events = [
    ...transformBirthdaysToEvents(users),
    ...transformWorkAnniversariesToEvents(users),
    ...publishedEvents,
    ...approvedLeaveEvents,
    ...getPublicHolidayEvents(holidayCountries),
  ]

  return (
    <Tabs defaultValue="outline">
      <TabsContent value="outline" className="relative flex flex-col overflow-auto py-4 px-4 lg:px-6">
        {/* <div className="p-4 lg:p-6">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div> */}
        <div className="w-full m-auto">
          <EventCalendar
            events={events}
            canCreateEvent={isAdmin(currentUser)}
            departmentOptions={options.departments}
            userOptions={options.users}
            defaultTimezone={companySettings.defaultTimezone}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
