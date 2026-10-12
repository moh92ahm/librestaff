'use client'

import * as React from 'react'
import { Check, Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { updatePublicLanguage } from '@/lib/actions/user-preferences'
import { APP_LANGUAGE_OPTIONS, type AppLocale } from '@/i18n/config'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type PublicLanguageSelectorProps = {
  enabledLanguages: AppLocale[]
  currentLanguage: AppLocale
}

export function PublicLanguageSelector({
  enabledLanguages,
  currentLanguage,
}: PublicLanguageSelectorProps) {
  const t = useTranslations('publicLanguage')
  const [pendingLanguage, setPendingLanguage] = React.useState<AppLocale | null>(null)
  const languages = APP_LANGUAGE_OPTIONS.filter((option) => enabledLanguages.includes(option.value))

  if (languages.length <= 1) return null

  const handleLanguageChange = async (locale: AppLocale) => {
    if (locale === currentLanguage || pendingLanguage) return
    setPendingLanguage(locale)
    try {
      await updatePublicLanguage(locale)
      notify.success(t('updated'))
      window.location.reload()
    } catch (error) {
      notify.error(error)
    } finally {
      setPendingLanguage(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Languages className="size-4" />
          {languages.find((language) => language.value === currentLanguage)?.nativeLabel || 'English'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.value}
            disabled={Boolean(pendingLanguage)}
            onClick={() => handleLanguageChange(language.value)}
          >
            <span>{language.nativeLabel}</span>
            {language.value === currentLanguage && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
