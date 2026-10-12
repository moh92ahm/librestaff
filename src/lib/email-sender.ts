import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import {
  getEnabledEmailSettings,
  getTestableEmailSettings,
  toEmailAddress,
  validateEmailSettingsValues,
  type EmailSettingsValues,
} from '@/lib/email-settings'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale } from '@/i18n/config'
import { getMessage } from '@/i18n/messages'

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text: string
}

function getTransportOptions(settings: EmailSettingsValues): SMTPTransport.Options {
  const secure = settings.secureMode === 'ssl' || (settings.secureMode === 'auto' && settings.smtpPort === 465)

  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure,
    requireTLS: settings.secureMode === 'starttls',
    ignoreTLS: settings.secureMode === 'none',
    ...(settings.authMode === 'login'
      ? {
          auth: {
            user: settings.smtpUsername || '',
            pass: settings.smtpPassword || '',
          },
        }
      : {}),
  }
}

async function sendWithSettings(settings: EmailSettingsValues, message: EmailMessage) {
  validateEmailSettingsValues(settings, { requireAuthSecrets: true })

  const transporter = nodemailer.createTransport(getTransportOptions(settings))

  await transporter.sendMail({
    from: toEmailAddress(settings),
    replyTo: settings.replyToEmail || undefined,
    ...message,
  })
}

export async function sendEmail(message: EmailMessage) {
  const settings = await getEnabledEmailSettings()

  if (!settings) {
    throw new Error('EMAIL_SETTINGS_NOT_CONFIGURED')
  }

  await sendWithSettings(settings, message)
}

export async function sendTestEmail(to: string) {
  const settings = await getTestableEmailSettings()
  const cookieStore = await cookies()
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value || DEFAULT_LOCALE)
  const subject = getMessage(locale, 'emails.testSubject')
  const heading = getMessage(locale, 'emails.testHeading')
  const body = getMessage(locale, 'emails.testBody')

  await sendWithSettings(settings, {
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h1 style="font-size: 20px;">${heading}</h1>
        <p>${body}</p>
      </div>
    `,
    text: body,
  })
}
