import { db } from '@/db'
import { emailSettingsTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  decryptSecret,
  encryptSecret,
  isEmailSettingsEncryptionConfigured,
} from '@/lib/encryption'

export const EMAIL_SETTINGS_ID = 'default'

export const SECURE_MODES = ['auto', 'ssl', 'starttls', 'none'] as const
export const AUTH_MODES = ['none', 'login'] as const
export const TEST_STATUSES = ['success', 'failed'] as const

export type EmailSecureMode = (typeof SECURE_MODES)[number]
export type EmailAuthMode = (typeof AUTH_MODES)[number]
export type EmailTestStatus = (typeof TEST_STATUSES)[number]

export type EmailSettingsValues = {
  enabled: boolean
  fromName: string
  fromEmail: string
  replyToEmail: string | null
  smtpHost: string
  smtpPort: number
  secureMode: EmailSecureMode
  authMode: EmailAuthMode
  smtpUsername?: string | null
  smtpPassword?: string | null
}

export type SafeEmailSettings = {
  id: string
  enabled: boolean
  fromName: string
  fromEmail: string
  replyToEmail: string | null
  smtpHost: string
  smtpPort: number
  secureMode: EmailSecureMode
  authMode: EmailAuthMode
  hasSmtpUsername: boolean
  hasSmtpPassword: boolean
  lastTestAt: string | null
  lastTestStatus: EmailTestStatus | null
  lastTestError: string | null
  encryptionConfigured: boolean
}

export const DEFAULT_EMAIL_SETTINGS = {
  id: EMAIL_SETTINGS_ID,
  enabled: false,
  fromName: 'LibreStaff',
  fromEmail: '',
  replyToEmail: null,
  smtpHost: '',
  smtpPort: 587,
  secureMode: 'starttls' as EmailSecureMode,
  authMode: 'none' as EmailAuthMode,
  encryptedSmtpUsername: null,
  encryptedSmtpPassword: null,
  lastTestAt: null,
  lastTestStatus: null,
  lastTestError: null,
}

function parseSecureMode(value: unknown): EmailSecureMode {
  return SECURE_MODES.includes(value as EmailSecureMode) ? (value as EmailSecureMode) : 'starttls'
}

function parseAuthMode(value: unknown): EmailAuthMode {
  return AUTH_MODES.includes(value as EmailAuthMode) ? (value as EmailAuthMode) : 'none'
}

function parseTestStatus(value: unknown): EmailTestStatus | null {
  return TEST_STATUSES.includes(value as EmailTestStatus) ? (value as EmailTestStatus) : null
}

function normalizePort(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 65535 ? Math.floor(value) : 587
}

export function toEmailAddress(settings: Pick<EmailSettingsValues, 'fromName' | 'fromEmail'>) {
  const name = settings.fromName.trim()
  const email = settings.fromEmail.trim()

  if (!name) {
    return email
  }

  return `"${name.replace(/"/g, '\\"')}" <${email}>`
}

export function validateEmailSettingsValues(
  values: EmailSettingsValues,
  options: { requireAuthSecrets?: boolean } = {},
) {
  if (!values.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.fromEmail)) {
    throw new Error('FROM_EMAIL_INVALID')
  }

  if (values.replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.replyToEmail)) {
    throw new Error('REPLY_TO_EMAIL_INVALID')
  }

  if (!values.smtpHost.trim()) {
    throw new Error('SMTP_HOST_REQUIRED')
  }

  if (!Number.isFinite(values.smtpPort) || values.smtpPort < 1 || values.smtpPort > 65535) {
    throw new Error('SMTP_PORT_INVALID')
  }

  if (values.authMode === 'login' && options.requireAuthSecrets !== false) {
    if (!values.smtpUsername?.trim()) {
      throw new Error('SMTP_USERNAME_REQUIRED')
    }

    if (!values.smtpPassword) {
      throw new Error('SMTP_PASSWORD_REQUIRED')
    }
  }
}

export async function getEmailSettingsRow() {
  const [existing] = await db
    .select()
    .from(emailSettingsTable)
    .where(eq(emailSettingsTable.id, EMAIL_SETTINGS_ID))
    .limit(1)

  return existing || null
}

export async function getOrCreateEmailSettings() {
  const existing = await getEmailSettingsRow()

  if (existing) {
    return existing
  }

  const now = new Date().toISOString()

  try {
    const [created] = await db
      .insert(emailSettingsTable)
      .values({
        ...DEFAULT_EMAIL_SETTINGS,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return created
  } catch {
    const createdByAnotherRequest = await getEmailSettingsRow()
    if (createdByAnotherRequest) return createdByAnotherRequest
    throw new Error('Failed to initialize email settings')
  }
}

export async function getSafeEmailSettings(): Promise<SafeEmailSettings> {
  const settings = await getOrCreateEmailSettings()

  return {
    id: settings.id,
    enabled: settings.enabled,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyToEmail: settings.replyToEmail,
    smtpHost: settings.smtpHost,
    smtpPort: normalizePort(settings.smtpPort),
    secureMode: parseSecureMode(settings.secureMode),
    authMode: parseAuthMode(settings.authMode),
    hasSmtpUsername: Boolean(settings.encryptedSmtpUsername),
    hasSmtpPassword: Boolean(settings.encryptedSmtpPassword),
    lastTestAt: settings.lastTestAt,
    lastTestStatus: parseTestStatus(settings.lastTestStatus),
    lastTestError: settings.lastTestError,
    encryptionConfigured: isEmailSettingsEncryptionConfigured(),
  }
}

export async function saveEmailSettings(values: EmailSettingsValues) {
  validateEmailSettingsValues(values, { requireAuthSecrets: false })

  const existing = await getOrCreateEmailSettings()
  const username = values.smtpUsername?.trim() || null
  const password = values.smtpPassword || null

  if ((username || password) && !isEmailSettingsEncryptionConfigured()) {
    throw new Error('EMAIL_SETTINGS_ENCRYPTION_KEY_MISSING')
  }

  const encryptedSmtpUsername =
    values.authMode === 'login'
      ? username
        ? encryptSecret(username)
        : existing.encryptedSmtpUsername
      : null
  const encryptedSmtpPassword =
    values.authMode === 'login'
      ? password
        ? encryptSecret(password)
        : existing.encryptedSmtpPassword
      : null

  if (values.authMode === 'login' && (!encryptedSmtpUsername || !encryptedSmtpPassword)) {
    throw new Error(!encryptedSmtpUsername ? 'SMTP_USERNAME_REQUIRED' : 'SMTP_PASSWORD_REQUIRED')
  }

  const [updated] = await db
    .update(emailSettingsTable)
    .set({
      enabled: false,
      fromName: values.fromName.trim() || DEFAULT_EMAIL_SETTINGS.fromName,
      fromEmail: values.fromEmail.trim().toLowerCase(),
      replyToEmail: values.replyToEmail?.trim().toLowerCase() || null,
      smtpHost: values.smtpHost.trim(),
      smtpPort: normalizePort(values.smtpPort),
      secureMode: parseSecureMode(values.secureMode),
      authMode: parseAuthMode(values.authMode),
      encryptedSmtpUsername,
      encryptedSmtpPassword,
      lastTestAt: null,
      lastTestStatus: null,
      lastTestError: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailSettingsTable.id, EMAIL_SETTINGS_ID))
    .returning()

  return updated
}

export async function markEmailSettingsTestResult(status: EmailTestStatus, error?: string) {
  await db
    .update(emailSettingsTable)
    .set({
      lastTestAt: new Date().toISOString(),
      lastTestStatus: status,
      lastTestError: error || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailSettingsTable.id, EMAIL_SETTINGS_ID))
}

export async function enableEmailSettings() {
  const settings = await getOrCreateEmailSettings()

  if (settings.lastTestStatus !== 'success') {
    throw new Error('EMAIL_TEST_REQUIRED')
  }

  await db
    .update(emailSettingsTable)
    .set({
      enabled: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailSettingsTable.id, EMAIL_SETTINGS_ID))
}

export async function disableEmailSettings() {
  await getOrCreateEmailSettings()

  await db
    .update(emailSettingsTable)
    .set({
      enabled: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(emailSettingsTable.id, EMAIL_SETTINGS_ID))
}

export async function getEnabledEmailSettings() {
  const settings = await getEmailSettingsRow()

  if (!settings || !settings.enabled) {
    return null
  }

  return {
    enabled: settings.enabled,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyToEmail: settings.replyToEmail,
    smtpHost: settings.smtpHost,
    smtpPort: normalizePort(settings.smtpPort),
    secureMode: parseSecureMode(settings.secureMode),
    authMode: parseAuthMode(settings.authMode),
    smtpUsername: settings.encryptedSmtpUsername
      ? decryptSecret(settings.encryptedSmtpUsername)
      : null,
    smtpPassword: settings.encryptedSmtpPassword
      ? decryptSecret(settings.encryptedSmtpPassword)
      : null,
  } satisfies EmailSettingsValues
}

export async function getTestableEmailSettings() {
  const settings = await getOrCreateEmailSettings()

  return {
    enabled: settings.enabled,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyToEmail: settings.replyToEmail,
    smtpHost: settings.smtpHost,
    smtpPort: normalizePort(settings.smtpPort),
    secureMode: parseSecureMode(settings.secureMode),
    authMode: parseAuthMode(settings.authMode),
    smtpUsername: settings.encryptedSmtpUsername
      ? decryptSecret(settings.encryptedSmtpUsername)
      : null,
    smtpPassword: settings.encryptedSmtpPassword
      ? decryptSecret(settings.encryptedSmtpPassword)
      : null,
  } satisfies EmailSettingsValues
}
