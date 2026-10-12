import type { Metadata } from 'next'
import '../(dashboard)/globals.css'
import { getCompanyBranding, getCompanyMetadata } from '@/lib/company-settings'
import { AppProviders } from '@/components/app-providers'
import { getCurrentUserPreferences } from '@/lib/user-preferences'
import { getMessagesForLocale } from '@/i18n/messages'
import { appViewport } from '@/lib/app-viewport'

export const viewport = appViewport

// Force dynamic rendering for employee pages
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const { companyName } = await getCompanyBranding()

  return getCompanyMetadata({
    defaultTitle: `Employee Portal | ${companyName}`,
    titleTemplate: `%s | ${companyName}`,
    description: `Employee portal for ${companyName}`,
  })
}

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getCurrentUserPreferences()
  const messages = getMessagesForLocale(preferences.locale)

  return (
    <html lang={preferences.locale} className={preferences.theme} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <AppProviders locale={preferences.locale} messages={messages} theme={preferences.theme}>
          <div className="min-h-dvh">{children}</div>
        </AppProviders>
      </body>
    </html>
  )
}
