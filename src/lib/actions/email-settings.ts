'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-guards'
import {
  disableEmailSettings,
  enableEmailSettings,
  markEmailSettingsTestResult,
  saveEmailSettings,
  type EmailAuthMode,
  type EmailSecureMode,
} from '@/lib/email-settings'
import { sendTestEmail } from '@/lib/email-sender'

export type EmailActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function saveEmailSettingsAction(
  _previousState: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  await requireAdmin()

  try {
    await saveEmailSettings({
      enabled: false,
      fromName: String(formData.get('fromName') || '').trim(),
      fromEmail: String(formData.get('fromEmail') || '').trim(),
      replyToEmail: String(formData.get('replyToEmail') || '').trim() || null,
      smtpHost: String(formData.get('smtpHost') || '').trim(),
      smtpPort: Number(formData.get('smtpPort') || 587),
      secureMode: String(formData.get('secureMode') || 'starttls') as EmailSecureMode,
      authMode: String(formData.get('authMode') || 'none') as EmailAuthMode,
      smtpUsername: String(formData.get('smtpUsername') || '').trim() || null,
      smtpPassword: String(formData.get('smtpPassword') || '') || null,
    })
    revalidatePath('/settings/email')
    return { status: 'success', message: 'Email settings saved. Send a test email before enabling.' }
  } catch (error) {
    return { status: 'error', message: getEmailSettingsActionError(error) }
  }
}

export async function sendTestEmailAction(
  _previousState: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  await requireAdmin()

  const testEmail = String(formData.get('testEmail') || '').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
    return { status: 'error', message: 'Enter a valid test recipient email address.' }
  }

  try {
    await sendTestEmail(testEmail)
    await markEmailSettingsTestResult('success')
    revalidatePath('/settings/email')
    return { status: 'success', message: `Test email sent to ${testEmail}.` }
  } catch (error) {
    const message = getEmailSettingsActionError(error)
    await markEmailSettingsTestResult('failed', message).catch(() => undefined)
    revalidatePath('/settings/email')
    return { status: 'error', message }
  }
}

export async function enableEmailSettingsAction(
  _previousState?: EmailActionState,
  _formData?: FormData,
): Promise<EmailActionState> {
  await requireAdmin()

  try {
    await enableEmailSettings()
    revalidatePath('/settings/email')
    return { status: 'success', message: 'Email sending is enabled.' }
  } catch (error) {
    return { status: 'error', message: getEmailSettingsActionError(error) }
  }
}

export async function disableEmailSettingsAction(
  _previousState?: EmailActionState,
  _formData?: FormData,
): Promise<EmailActionState> {
  await requireAdmin()

  try {
    await disableEmailSettings()
    revalidatePath('/settings/email')
    return { status: 'success', message: 'Email sending is disabled.' }
  } catch (error) {
    return { status: 'error', message: getEmailSettingsActionError(error) }
  }
}

function getEmailSettingsActionError(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  switch (message) {
    case 'EMAIL_SETTINGS_ENCRYPTION_KEY_MISSING':
      return 'EMAIL_SETTINGS_ENCRYPTION_KEY is missing or invalid. Add it before saving SMTP secrets.'
    case 'EMAIL_SETTINGS_ENCRYPTION_KEY_INVALID':
      return 'EMAIL_SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes.'
    case 'FROM_EMAIL_INVALID':
      return 'Enter a valid From email address.'
    case 'REPLY_TO_EMAIL_INVALID':
      return 'Enter a valid Reply-To email address, or leave it blank.'
    case 'SMTP_HOST_REQUIRED':
      return 'SMTP host is required.'
    case 'SMTP_PORT_INVALID':
      return 'SMTP port must be between 1 and 65535.'
    case 'SMTP_USERNAME_REQUIRED':
      return 'SMTP username is required when authentication is enabled.'
    case 'SMTP_PASSWORD_REQUIRED':
      return 'SMTP password is required when authentication is enabled.'
    case 'EMAIL_TEST_REQUIRED':
      return 'Send a successful test email before enabling email sending.'
    default:
      return message || 'Email settings could not be saved.'
  }
}
