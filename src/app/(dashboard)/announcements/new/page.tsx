import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('newAnnouncement'),
  }
}

export default async function NewAnnouncementPage() {
  redirect('/announcements?compose=new')
}
