import { cookies } from 'next/headers'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { auth } from '@/auth'
import { eq } from 'drizzle-orm'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  normalizeEnabledLanguages,
  normalizeLocale,
  type AppLocale,
} from '@/i18n/config'
import { getOrCreateCompanySettings } from '@/lib/company-settings'
import { DEFAULT_THEME, normalizeTheme, type AppTheme } from '@/lib/theme'

export type UserPreferences = {
  locale: AppLocale
  theme: AppTheme
  enabledLanguages: AppLocale[]
}

export async function getCurrentUserPreferences(): Promise<UserPreferences> {
  const session = await auth()
  const userId = session?.user?.id
  const companySettings = await getOrCreateCompanySettings()
  const enabledLanguages = normalizeEnabledLanguages(companySettings.enabledLanguages || [])

  if (!userId) {
    return {
      locale: DEFAULT_LOCALE,
      theme: DEFAULT_THEME,
      enabledLanguages,
    }
  }

  const user = await db.query.usersTable.findFirst({
    columns: {
      language: true,
      theme: true,
    },
    where: eq(usersTable.id, userId),
  })

  const locale = normalizeLocale(user?.language, enabledLanguages)
  const theme = normalizeTheme(user?.theme)

  return {
    locale,
    theme,
    enabledLanguages,
  }
}

export async function getPublicPreferences(): Promise<UserPreferences> {
  const cookieStore = await cookies()
  const companySettings = await getOrCreateCompanySettings()
  const enabledLanguages = normalizeEnabledLanguages(companySettings.enabledLanguages || [])
  const locale = normalizeLocale(
    cookieStore.get(LOCALE_COOKIE)?.value || DEFAULT_LOCALE,
    enabledLanguages,
  )

  return {
    locale,
    theme: DEFAULT_THEME,
    enabledLanguages,
  }
}
