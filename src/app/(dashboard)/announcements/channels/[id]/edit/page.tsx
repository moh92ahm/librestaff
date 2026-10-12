import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requirePermission } from '@/lib/permissions'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('announcements')

  return {
    title: t('editChannel'),
  }
}

export default async function EditAnnouncementChannelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('announcements', 'edit')
  const { id } = await params

  redirect(`/announcements?channelEdit=${encodeURIComponent(id)}`)
}
