import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requirePermission } from '@/lib/permissions'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('newChannel'),
  }
}

export default async function NewAnnouncementChannelPage() {
  await requirePermission('announcements', 'create')

  redirect('/announcements?channel=new')
}
