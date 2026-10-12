'use client'

import { toast, type ExternalToast } from 'sonner'

export type NotifyType = 'success' | 'error' | 'warning' | 'info'
export const CLIENT_FLASH_TOAST_KEY = 'librestaff_client_flash_toast'

function getErrorMessage(errorOrMessage: unknown, fallback = 'Something went wrong') {
  if (errorOrMessage instanceof Error) return errorOrMessage.message
  if (typeof errorOrMessage === 'string' && errorOrMessage.trim()) return errorOrMessage
  return fallback
}

export const notify = {
  success(message: string, options?: ExternalToast) {
    return toast.success(message, options)
  },
  error(errorOrMessage: unknown, fallback?: string, options?: ExternalToast) {
    return toast.error(getErrorMessage(errorOrMessage, fallback), options)
  },
  warning(message: string, options?: ExternalToast) {
    return toast.warning(message, options)
  },
  info(message: string, options?: ExternalToast) {
    return toast.info(message, options)
  },
  loading(message: string, options?: ExternalToast) {
    return toast.loading(message, options)
  },
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    },
  ) {
    return toast.promise(promise, messages)
  },
  flash(type: NotifyType, message: string) {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      CLIENT_FLASH_TOAST_KEY,
      JSON.stringify({ type, message, createdAt: Date.now() }),
    )
  },
}

export { getErrorMessage }
