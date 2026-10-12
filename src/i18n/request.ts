import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from './config'
import { getMessagesForLocale } from './messages'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value || DEFAULT_LOCALE)

  return {
    locale,
    messages: getMessagesForLocale(locale),
    timeZone: 'UTC',
  }
})
