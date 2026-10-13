import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { HomePageContent } from '@/components/home/home-page-content'
import { getHomePageData } from '@/lib/actions/home'
import { requireAuth } from '@/lib/auth-guards'
import type { User } from '@/lib/rbac'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home')

  return {
    title: t('metadataTitle'),
  }
}

export default async function HomePage() {
  const user = (await requireAuth()) as User
  const home = await getHomePageData()

  return <HomePageContent home={home} userName={user.name} />
}
