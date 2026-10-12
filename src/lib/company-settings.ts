import { db } from '@/db'
import { companySettingsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'

export const COMPANY_SETTINGS_ID = 'default'

export const DEFAULT_COMPANY_SETTINGS = {
  id: COMPANY_SETTINGS_ID,
  companyName: 'LibreStaff',
  logoUrl: '/brand/LibreStaff-Logo.png',
  website: '',
  companyEmail: '',
  phone: '',
  country: '',
  address: '',
  taxRegistrationNumber: '',
  defaultTimezone: 'Europe/Istanbul',
  workingWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  holidayCountries: [],
  enabledLanguages: ['en'],
}

export type CompanySettings = typeof DEFAULT_COMPANY_SETTINGS & {
  createdAt: string
  updatedAt: string
}

export async function getOrCreateCompanySettings() {
  const [existing] = await db
    .select()
    .from(companySettingsTable)
    .where(eq(companySettingsTable.id, COMPANY_SETTINGS_ID))
    .limit(1)

  if (existing) {
    return existing
  }

  const now = new Date().toISOString()

  try {
    const [created] = await db
      .insert(companySettingsTable)
      .values({
        ...DEFAULT_COMPANY_SETTINGS,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return created
  } catch {
    const [createdByAnotherRequest] = await db
      .select()
      .from(companySettingsTable)
      .where(eq(companySettingsTable.id, COMPANY_SETTINGS_ID))
      .limit(1)

    if (createdByAnotherRequest) {
      return createdByAnotherRequest
    }

    throw new Error('Failed to initialize company settings')
  }
}

export async function getCompanyBranding() {
  try {
    const settings = await getOrCreateCompanySettings()
    return {
      companyName: settings.companyName || DEFAULT_COMPANY_SETTINGS.companyName,
      logoUrl: settings.logoUrl || DEFAULT_COMPANY_SETTINGS.logoUrl,
      updatedAt: settings.updatedAt,
    }
  } catch {
    return {
      companyName: DEFAULT_COMPANY_SETTINGS.companyName,
      logoUrl: DEFAULT_COMPANY_SETTINGS.logoUrl,
      updatedAt: 'default',
    }
  }
}

type CompanyMetadataInput = {
  defaultTitle?: string
  titleTemplate?: string
  description: string
}

export async function getCompanyMetadata({
  defaultTitle,
  titleTemplate,
  description,
}: CompanyMetadataInput): Promise<Metadata> {
  const { companyName, updatedAt } = await getCompanyBranding()
  const iconVersion = encodeURIComponent(updatedAt)

  return {
    title: {
      default: defaultTitle || companyName,
      template: titleTemplate || `%s | ${companyName}`,
    },
    description,
    icons: {
      icon: [
        { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
        { url: `/api/pwa/icon?size=96&variant=standard&v=${iconVersion}`, sizes: '96x96' },
      ],
      apple: [
        {
          url: `/api/pwa/icon?size=180&variant=standard&v=${iconVersion}`,
          sizes: '180x180',
          type: 'image/png',
        },
      ],
    },
    manifest: '/manifest.webmanifest',
  }
}
