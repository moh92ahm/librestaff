import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { companySettingsTable, usersTable } from '@/db/schema'
import { CompanySettingsForm } from '@/components/settings/company-settings-form'
import { COMPANY_SETTINGS_ID, getOrCreateCompanySettings } from '@/lib/company-settings'
import { getHolidayCountryOptions, normalizeHolidayCountryCodes } from '@/lib/holiday-utils'
import { normalizeEnabledLanguages } from '@/i18n/config'
import { requireAdmin } from '@/lib/auth-guards'
import { eq } from 'drizzle-orm'
import { savePublicRasterMedia } from '@/lib/media-storage'

export const metadata: Metadata = {
  title: 'Company Settings',
  description: 'Manage company profile and branding',
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

async function uploadLogo(file: File, companyName: string) {
  const media = await savePublicRasterMedia({
    file,
    category: 'company-logos',
    alt: `${companyName} logo`,
  })
  return media.url
}

export default async function CompanySettingsPage() {
  await requireAdmin()
  const settings = await getOrCreateCompanySettings()
  const holidayCountryOptions = getHolidayCountryOptions()

  const updateCompanySettingsAction = async (formData: FormData) => {
    'use server'

    await requireAdmin()

    const companyName = readText(formData, 'companyName') || 'LibreStaff'
    const logo = formData.get('logo') as File | null
    let logoUrl = readText(formData, 'logoUrl') || '/brand/LibreStaff-Logo.png'

    if (logo && typeof logo === 'object' && 'arrayBuffer' in logo && logo.size > 0) {
      logoUrl = await uploadLogo(logo, companyName)
    }

    const workingWeek = formData.getAll('workingWeek').map((value) => String(value))
    const holidayCountries = normalizeHolidayCountryCodes(
      formData.getAll('holidayCountries').map((value) => String(value)),
    )
    const enabledLanguages = normalizeEnabledLanguages(
      formData.getAll('enabledLanguages').map((value) => String(value)),
    )

    await db
      .update(companySettingsTable)
      .set({
        companyName,
        logoUrl,
        website: readText(formData, 'website') || null,
        companyEmail: readText(formData, 'companyEmail') || null,
        phone: readText(formData, 'phone') || null,
        country: readText(formData, 'country') || null,
        address: readText(formData, 'address') || null,
        taxRegistrationNumber: readText(formData, 'taxRegistrationNumber') || null,
        defaultTimezone: readText(formData, 'defaultTimezone') || 'Europe/Istanbul',
        workingWeek: workingWeek.length
          ? workingWeek
          : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        holidayCountries,
        enabledLanguages,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(companySettingsTable.id, COMPANY_SETTINGS_ID))

    if (!enabledLanguages.includes('tr')) {
      await db
        .update(usersTable)
        .set({
          language: 'en',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(usersTable.language, 'tr'))
    }

    revalidatePath('/')
    revalidatePath('/login')
    revalidatePath('/calendar')
    revalidatePath('/leaves')
    revalidatePath('/settings/company')
    revalidatePath('/settings/leaves')
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <CompanySettingsForm
          settings={settings}
          action={updateCompanySettingsAction}
          holidayCountryOptions={holidayCountryOptions}
        />
      </div>
    </div>
  )
}
