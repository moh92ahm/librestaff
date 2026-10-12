import en from '../../messages/en.json'
import tr from '../../messages/tr.json'
import de from '../../messages/de.json'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from './config'

type AppMessages = typeof en

const messages = {
  en,
  tr,
  de,
} satisfies Record<AppLocale, AppMessages>

export function getMessagesForLocale(locale: AppLocale | string) {
  return isAppLocale(locale) ? messages[locale] : messages[DEFAULT_LOCALE]
}

export function getMessage(locale: AppLocale, path: string, values: Record<string, string> = {}) {
  const parts = path.split('.')
  let current: unknown = getMessagesForLocale(locale)

  for (const part of parts) {
    current =
      typeof current === 'object' && current && part in current
        ? (current as Record<string, unknown>)[part]
        : undefined
  }

  const template = typeof current === 'string' ? current : path
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  )
}
