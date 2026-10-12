import { getOrCreateCompanySettings } from '@/lib/company-settings'
import {
  getCalendarHolidayYears,
  getPublicHolidayDateSet,
  getPublicHolidayDateSetForRange,
} from '@/lib/holiday-utils'

export async function getCompanyHolidayCountries() {
  const settings = await getOrCreateCompanySettings()
  return settings.holidayCountries || []
}

export async function getCompanyCalendarHolidayDates() {
  const holidayCountries = await getCompanyHolidayCountries()
  return Array.from(getPublicHolidayDateSet(holidayCountries, getCalendarHolidayYears()))
}

export async function getCompanyHolidayDatesForLeaveRange(startDate: string, endDate: string) {
  const holidayCountries = await getCompanyHolidayCountries()
  return getPublicHolidayDateSetForRange(holidayCountries, startDate, endDate)
}
