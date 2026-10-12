import type { Metadata } from 'next'
import '../(dashboard)/globals.css'
import { getCompanyMetadata } from '@/lib/company-settings'
import { AppProviders } from '@/components/app-providers'
import { getPublicPreferences } from '@/lib/user-preferences'
import { getMessagesForLocale } from '@/i18n/messages'
import { PublicLanguageSelector } from '@/components/public-language-selector'
import { appViewport } from '@/lib/app-viewport'

export const viewport = appViewport

export async function generateMetadata(): Promise<Metadata> {
  return getCompanyMetadata({
    description: 'Employee management and payroll system',
  })
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getPublicPreferences()
  const messages = getMessagesForLocale(preferences.locale)

  return (
    <html lang={preferences.locale} className={preferences.theme} suppressHydrationWarning>
      <body>
        <AppProviders
          locale={preferences.locale}
          messages={messages}
          theme={preferences.theme}
          session={false}
        >
          <div className="fixed right-4 top-4 z-50">
            <PublicLanguageSelector
              enabledLanguages={preferences.enabledLanguages}
              currentLanguage={preferences.locale}
            />
          </div>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
