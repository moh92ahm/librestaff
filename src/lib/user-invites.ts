import { createHash, randomBytes } from 'crypto'
import { getCompanyBranding } from '@/lib/company-settings'
import { sendEmail } from '@/lib/email-sender'
import { getEnabledEmailSettings } from '@/lib/email-settings'
import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from '@/i18n/config'
import { getMessage } from '@/i18n/messages'

export const INVITE_EXPIRY_DAYS = 7

export function createInviteToken() {
  return randomBytes(32).toString('base64url')
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getInviteExpiryDate(now = new Date()) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)
  return expiresAt
}

export function isInviteExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now()
}

export function getAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

  return raw.replace(/\/$/, '')
}

export function getSignupInviteUrl(token: string) {
  return `${getAppBaseUrl()}/signup?token=${encodeURIComponent(token)}`
}

export async function isInviteEmailConfigured() {
  return Boolean(await getEnabledEmailSettings())
}

async function getInviteEmailContent(inviteUrl: string, expiresAt: string, locale: AppLocale) {
  const { companyName } = await getCompanyBranding()
  const expires = new Date(expiresAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const values = { companyName, inviteUrl, expires }

  return {
    subject: getMessage(locale, 'emails.inviteSubject', values),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h1 style="font-size: 20px;">${getMessage(locale, 'emails.inviteHeading', values)}</h1>
        <p>${getMessage(locale, 'emails.inviteBody', values)}</p>
        <p><a href="${inviteUrl}">${getMessage(locale, 'emails.inviteButton', values)}</a></p>
        <p>${getMessage(locale, 'emails.inviteExpiry', values)}</p>
      </div>
    `,
    text: getMessage(locale, 'emails.inviteText', values),
  }
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  expiresAt,
  locale = DEFAULT_LOCALE,
}: {
  to: string
  inviteUrl: string
  expiresAt: string
  locale?: string | null
}) {
  const safeLocale = normalizeLocale(locale || DEFAULT_LOCALE)
  const content = await getInviteEmailContent(inviteUrl, expiresAt, safeLocale)
  await sendEmail({ to, ...content })
}
