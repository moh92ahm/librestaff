import type { MetadataRoute } from 'next'
import { getCompanyBranding } from '@/lib/company-settings'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { companyName, updatedAt } = await getCompanyBranding()
  const version = encodeURIComponent(updatedAt)

  return {
    id: '/',
    name: companyName,
    short_name: companyName,
    description: `${companyName} employee portal`,
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: `/api/pwa/icon?size=192&variant=standard&v=${version}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/pwa/icon?size=512&variant=standard&v=${version}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/api/pwa/icon?size=192&variant=maskable&v=${version}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/api/pwa/icon?size=512&variant=maskable&v=${version}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    theme_color: '#f8faf5',
    background_color: '#f8faf5',
    display: 'standalone',
    orientation: 'portrait-primary',
  }
}
