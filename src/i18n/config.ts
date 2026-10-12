import 'moment/locale/de'
import 'moment/locale/tr'
import { de, enUS, tr } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'

export const LOCALE_COOKIE = 'librestaff_locale'

type LocaleRegistryEntry = {
  label: string
  nativeLabel: string
  dateFnsLocale: DateFnsLocale
  calendarCulture: string
  locked?: boolean
}

export const LOCALE_REGISTRY = {
  en: {
    label: 'English',
    nativeLabel: 'English',
    dateFnsLocale: enUS,
    calendarCulture: 'en',
    locked: true,
  },
  tr: {
    label: 'Turkish',
    nativeLabel: 'Türkçe',
    dateFnsLocale: tr,
    calendarCulture: 'tr',
  },
  de: {
    label: 'German',
    nativeLabel: 'Deutsch',
    dateFnsLocale: de,
    calendarCulture: 'de',
  },
} as const satisfies Record<string, LocaleRegistryEntry>

export type AppLocale = keyof typeof LOCALE_REGISTRY
export const DEFAULT_LOCALE = 'en' satisfies AppLocale
export const SUPPORTED_LOCALES = Object.keys(LOCALE_REGISTRY) as AppLocale[]

export type AppLanguageOption = {
  value: AppLocale
  label: string
  nativeLabel: string
  locked?: boolean
}

export const APP_LANGUAGE_OPTIONS: AppLanguageOption[] = SUPPORTED_LOCALES.map((value) => {
  const locale = LOCALE_REGISTRY[value]
  return {
    value,
    label: locale.label,
    nativeLabel: locale.nativeLabel,
    locked: 'locked' in locale ? locale.locked : undefined,
  }
})

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES)

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && LOCALE_SET.has(value)
}

export function normalizeEnabledLanguages(values: unknown[]): AppLocale[] {
  const normalized = new Set<AppLocale>([DEFAULT_LOCALE])

  for (const value of values) {
    if (isAppLocale(value)) normalized.add(value)
  }

  return Array.from(normalized)
}

export function normalizeLocale(value: unknown, enabledLanguages?: string[]): AppLocale {
  const enabled = normalizeEnabledLanguages(enabledLanguages || [DEFAULT_LOCALE])
  return isAppLocale(value) && enabled.includes(value) ? value : DEFAULT_LOCALE
}

export function getLocaleConfig(locale: unknown) {
  return isAppLocale(locale) ? LOCALE_REGISTRY[locale] : LOCALE_REGISTRY[DEFAULT_LOCALE]
}

export function getDateFnsLocale(locale: unknown) {
  return getLocaleConfig(locale).dateFnsLocale
}

export function getCalendarCulture(locale: unknown) {
  return getLocaleConfig(locale).calendarCulture
}

export function getLanguageLabel(locale: string) {
  return getLocaleConfig(locale).nativeLabel
}
