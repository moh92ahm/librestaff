'use server'

import { cookies } from 'next/headers'

export type FlashToastType = 'success' | 'error' | 'warning' | 'info'

const FLASH_TOAST_COOKIE = 'librestaff_flash_toast'
const MAX_MESSAGE_LENGTH = 240

export async function setFlashToast(type: FlashToastType, message: string) {
  const safeType: FlashToastType = ['success', 'error', 'warning', 'info'].includes(type)
    ? type
    : 'info'
  const safeMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH)

  if (!safeMessage) return

  const payload = Buffer.from(
    JSON.stringify({
      type: safeType,
      message: safeMessage,
      createdAt: Date.now(),
    }),
    'utf8',
  ).toString('base64url')

  const cookieStore = await cookies()
  cookieStore.set(FLASH_TOAST_COOKIE, payload, {
    path: '/',
    maxAge: 30,
    sameSite: 'lax',
  })
}
