import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mediaTable } from '@/db/schema'
import { getServerSession } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import {
  deleteStoredMedia,
  documentMimeTypes,
  imageMimeTypes,
  saveUploadedMedia,
} from '@/lib/media-storage'
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

// DELETE - Remove uploaded file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    // Get file info from database
    const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, fileId)).limit(1)

    if (!media) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    await deleteStoredMedia(media.storageKey)

    // Delete from database
    await db.delete(mediaTable).where(eq(mediaTable.id, fileId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
