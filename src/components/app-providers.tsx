'use client'

import * as React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { SessionProvider } from 'next-auth/react'
import { AppSonner } from '@/components/app-sonner'
import { FlashToastProvider } from '@/components/flash-toast-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration'
import { PwaInstallProvider } from '@/components/pwa/pwa-install-provider'
import type { AppLocale } from '@/i18n/config'

type AppProvidersProps = {
  children: React.ReactNode
  locale: AppLocale
  messages: Record<string, unknown>
  theme?: 'light' | 'dark'
  session?: boolean
}

export function AppProviders({
  children,
  locale,
  messages,
  theme = 'light',
  session = true,
}: AppProvidersProps) {
  const content = (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider defaultTheme={theme}>
        <ServiceWorkerRegistration />
        <PwaInstallProvider>
          <AppSonner />
          <FlashToastProvider />
          {children}
        </PwaInstallProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  )

  return session ? <SessionProvider>{content}</SessionProvider> : content
}
