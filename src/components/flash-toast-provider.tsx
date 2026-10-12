'use client'

import * as React from 'react'
import { CLIENT_FLASH_TOAST_KEY, notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

type FlashToastType = 'success' | 'error' | 'warning' | 'info'

const FLASH_TOAST_COOKIE = 'librestaff_flash_toast'

function getCookieValue(name: string) {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

const FLASH_MESSAGE_KEYS: Record<string, string> = {
  'Payroll generated': 'payroll.generated',
  'Payroll updated': 'payroll.updated',
  'Payment status updated': 'payroll.statusUpdated',
  'Payment deleted': 'payroll.deleted',
  'Payroll setting created': 'payroll.settingCreated',
  'Payroll setting updated': 'payroll.settingUpdated',
  'Payroll setting deleted': 'payroll.settingDeleted',
  'Additional payment created': 'payroll.additionalCreated',
  'Additional payment updated': 'payroll.additionalUpdated',
  'Leave request created': 'leaves.requestCreated',
  'Leave request updated': 'leaves.requestUpdated',
  'Leave request submitted': 'leaves.requestSubmitted',
  'Leave status updated': 'leaves.statusUpdated',
  'Inventory item created': 'inventory.itemCreated',
  'Inventory item updated': 'inventory.itemUpdated',
  'User created successfully': 'users.userCreated',
  'User updated successfully': 'users.userUpdated',
  'Documents uploaded': 'profile.documentsUploaded',
  'Document deleted': 'profile.documentDeleted',
  'Expense created': 'expenses.created',
  'Expense updated': 'expenses.updated',
  'Expense deleted': 'expenses.deleted',
}

function showFlashToast(type: FlashToastType, message: string) {
  switch (type) {
    case 'success':
      notify.success(message)
      break
    case 'error':
      notify.error(message)
      break
    case 'warning':
      notify.warning(message)
      break
    default:
      notify.info(message)
      break
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

export function FlashToastProvider() {
  const t = useTranslations()
  const translateMessage = React.useCallback(
    (message: string) => {
      const key = FLASH_MESSAGE_KEYS[message]
      return key ? t(key as any) : message
    },
    [t],
  )

  React.useEffect(() => {
    const value = window.sessionStorage.getItem(CLIENT_FLASH_TOAST_KEY)
    if (!value) return

    window.sessionStorage.removeItem(CLIENT_FLASH_TOAST_KEY)

    try {
      const decoded = JSON.parse(value) as {
        type?: FlashToastType
        message?: string
        createdAt?: number
      }

      if (!decoded.message || Date.now() - Number(decoded.createdAt || 0) > 30000) {
        return
      }

      showFlashToast(decoded.type || 'info', translateMessage(decoded.message))
    } catch {
      window.sessionStorage.removeItem(CLIENT_FLASH_TOAST_KEY)
    }
  }, [translateMessage])

  React.useEffect(() => {
    const value = getCookieValue(FLASH_TOAST_COOKIE)
    if (!value) return

    clearCookie(FLASH_TOAST_COOKIE)

    try {
      const decoded = JSON.parse(decodeBase64Url(value)) as {
        type?: FlashToastType
        message?: string
        createdAt?: number
      }

      if (!decoded.message || Date.now() - Number(decoded.createdAt || 0) > 30000) {
        return
      }

      showFlashToast(decoded.type || 'info', translateMessage(decoded.message))
    } catch {
      clearCookie(FLASH_TOAST_COOKIE)
    }
  }, [translateMessage])

  return null
}
