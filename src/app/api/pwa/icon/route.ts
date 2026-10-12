import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getCompanyBranding } from '@/lib/company-settings'

export const runtime = 'nodejs'

const supportedSizes = new Set([96, 180, 192, 512])
const publicRoot = path.resolve(process.cwd(), 'public')

function resolvePublicImage(url: string) {
  let pathname: string

  try {
    pathname = decodeURIComponent(new URL(url, 'https://librestaff.local').pathname)
  } catch {
    return null
  }

  if (!['/brand/', '/favicon/', '/media/'].some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  const resolved = path.resolve(publicRoot, `.${pathname}`)
  return resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null
}

function fallbackPath(size: number) {
  if (size === 180) return path.join(publicRoot, 'favicon', 'apple-touch-icon.png')
  if (size <= 192) {
    return path.join(publicRoot, 'favicon', 'web-app-manifest-192x192.png')
  }
  return path.join(publicRoot, 'favicon', 'web-app-manifest-512x512.png')
}

async function readBrandImage(size: number) {
  const { logoUrl } = await getCompanyBranding()
  const localPath = resolvePublicImage(logoUrl)

  if (localPath) {
    try {
      return await readFile(localPath)
    } catch {
      // Fall through to the generated, known-good icon asset.
    }
  }

  return readFile(fallbackPath(size))
}

export async function GET(request: NextRequest) {
  const requestedSize = Number(request.nextUrl.searchParams.get('size'))
  const variant = request.nextUrl.searchParams.get('variant')

  if (!supportedSizes.has(requestedSize) || !['standard', 'maskable'].includes(variant || '')) {
    return NextResponse.json({ error: 'Unsupported PWA icon request' }, { status: 400 })
  }

  try {
    const source = await readBrandImage(requestedSize)
    const paddingRatio = variant === 'maskable' ? 0.2 : 0.1
    const contentSize = Math.max(1, Math.round(requestedSize * (1 - paddingRatio * 2)))
    const padding = Math.floor((requestedSize - contentSize) / 2)
    const trailingPadding = requestedSize - contentSize - padding
    const icon = await sharp(source)
      .resize(contentSize, contentSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
        withoutEnlargement: false,
      })
      .extend({
        top: padding,
        right: trailingPadding,
        bottom: trailingPadding,
        left: padding,
        background: { r: 248, g: 250, b: 245, alpha: 1 },
      })
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(icon), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Failed to generate PWA icon:', error)
    return NextResponse.json({ error: 'Could not generate PWA icon' }, { status: 500 })
  }
}
