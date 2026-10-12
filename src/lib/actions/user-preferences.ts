'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { requireAuth } from '@/lib/auth-guards'
import { getOrCreateCompanySettings } from '@/lib/company-settings'
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from '@/i18n/config'
import { normalizeTheme, type AppTheme } from '@/lib/theme'
import { eq } from 'drizzle-orm'

export async function updateCurrentUserLanguage(locale: string) {
  const user = await requireAuth()
  const companySettings = await getOrCreateCompanySettings()
  const safeLocale = normalizeLocale(locale, companySettings.enabledLanguages || [DEFAULT_LOCALE])

  await db
    .update(usersTable)
    .set({
      language: safeLocale,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usersTable.id, user.id))

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, safeLocale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/', 'layout')
  return { language: safeLocale }
}

export async function updateCurrentUserTheme(theme: AppTheme) {
  const user = await requireAuth()
  const safeTheme = normalizeTheme(theme)

  await db
    .update(usersTable)
    .set({
      theme: safeTheme,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usersTable.id, user.id))

  revalidatePath('/', 'layout')
  return { theme: safeTheme }
}

export async function updatePublicLanguage(locale: string) {
  const companySettings = await getOrCreateCompanySettings()
  const safeLocale = normalizeLocale(locale, companySettings.enabledLanguages || [DEFAULT_LOCALE])

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, safeLocale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/', 'layout')
  return { language: safeLocale }
}
