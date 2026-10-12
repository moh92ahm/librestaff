import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/company-settings', () => ({
  getCompanyBranding: vi.fn(async () => ({
    companyName: 'Acme Team',
    logoUrl: '/brand/LibreStaff-Logo.png',
    updatedAt: '2026-07-29T12:00:00.000Z',
  })),
}))

describe('PWA installation assets', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('publishes a standalone, scoped and versioned company manifest', async () => {
    const { default: manifest } = await import('@/app/manifest')
    const result = await manifest()

    expect(result).toMatchObject({
      id: '/',
      name: 'Acme Team',
      short_name: 'Acme Team',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait-primary',
    })
    expect(result.icons).toHaveLength(4)
    expect(result.icons?.every((icon) => icon.src.includes('v=2026-07-29T12%3A00%3A00.000Z'))).toBe(
      true,
    )
    expect(result.icons?.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  it.each([
    [180, 'standard'],
    [192, 'maskable'],
    [512, 'standard'],
  ])('generates a valid %ipx %s PNG icon', async (size, variant) => {
    const { GET } = await import('@/app/api/pwa/icon/route')
    const response = await GET(
      new NextRequest(`http://localhost/api/pwa/icon?size=${size}&variant=${variant}`),
    )
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(metadata).toMatchObject({ width: size, height: size, format: 'png' })
  })

  it('rejects unsupported icon parameters', async () => {
    const { GET } = await import('@/app/api/pwa/icon/route')
    const response = await GET(
      new NextRequest('http://localhost/api/pwa/icon?size=256&variant=standard'),
    )

    expect(response.status).toBe(400)
  })

  it('registers a service worker without offline fetch caching', async () => {
    const worker = await readFile(path.join(process.cwd(), 'public', 'sw.js'), 'utf8')

    expect(worker).toContain("self.addEventListener('install'")
    expect(worker).toContain("self.addEventListener('activate'")
    expect(worker).not.toContain("addEventListener('fetch'")
    expect(worker).not.toContain('caches.open')
  })
})
