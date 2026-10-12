import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('editAnnouncement'),
  }
}

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  redirect(`/announcements?edit=${encodeURIComponent(id)}`)
}
