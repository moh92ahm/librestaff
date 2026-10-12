'use server'

import { requireAuth } from '@/lib/auth-guards'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/notifications'

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireAuth()
  const id = String(formData.get('id') || '').trim()
  if (!id) throw new Error('Notification ID is required.')

  await markNotificationRead(id, user.id)
}

export async function markAllNotificationsReadAction(_formData?: FormData) {
  const user = await requireAuth()
  await markAllNotificationsRead(user.id)
}
