import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { hasPermission } from '@/lib/permissions'

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
const ALLOWED_TYPES = [...imageMimeTypes, ...documentMimeTypes]

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const purpose = String(formData.get('purpose') || '')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!['employee-photo', 'employee-document', 'announcement', 'inventory'].includes(purpose)) {
      return NextResponse.json({ error: 'Upload purpose is required' }, { status: 400 })
    }

    const permission =
      purpose === 'announcement'
        ? await hasPermission(session.user as any, 'announcements', 'create')
        : purpose === 'inventory'
          ? await hasPermission(session.user as any, 'inventory', 'create')
          : await hasPermission(session.user as any, 'employees', 'edit')

    if (!permission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const limit = await consumeRateLimit({
      scope: 'upload',
      key: `${session.user.id}:${getClientIp(request)}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit)
    }

    const mediaRecord = await saveUploadedMedia({
      file,
      category: purpose,
      allowedMimeTypes: ALLOWED_TYPES,
      maxSize: MAX_FILE_SIZE,
      alt: (formData.get('alt') as string) || file.name,
    })

    return NextResponse.json({
      success: true,
      file: mediaRecord,
      url: mediaRecord.url,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// Media can only be deleted through a resource-specific endpoint that verifies
// the caller may edit the record to which the file is attached.
export async function DELETE(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Delete media through its owning resource.' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
