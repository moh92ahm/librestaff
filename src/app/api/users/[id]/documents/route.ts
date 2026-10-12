import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { canAccessTargetUser, requirePermissionAPI } from '@/lib/permissions'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
const ALLOWED_TYPES = [...imageMimeTypes, ...documentMimeTypes]

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermissionAPI('employees', 'edit')
    if (!actor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: userId } = await params
    if (!(await canAccessTargetUser(actor, 'employees', 'edit', userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const limit = await consumeRateLimit({
      scope: 'document-upload',
      key: `${actor.id}:${getClientIp(request)}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit)
    }

    // Verify user exists
    const [user] = await db
      .select({ id: usersTable.id, documents: usersTable.documents })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const uploadedMediaIds: string[] = []

    // Process each uploaded file
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('documents[') || !(value instanceof File)) continue

      const file = value as File
      const maxSizeMB = Math.floor(MAX_FILE_SIZE / 1024 / 1024)

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: 'File too large',
            code: 'FILE_TOO_LARGE',
            maxSizeMB,
          },
          { status: 413 },
        )
      }

      const mediaRecord = await saveUploadedMedia({
        file,
        category: 'employee-documents',
        allowedMimeTypes: ALLOWED_TYPES,
        maxSize: MAX_FILE_SIZE,
        alt: file.name,
      })

      uploadedMediaIds.push(mediaRecord.id)
    }

    if (uploadedMediaIds.length === 0) {
      return NextResponse.json({ error: 'No valid files provided' }, { status: 400 })
    }

    // Append new media IDs to user's documents array
    const existingDocs: string[] = Array.isArray(user.documents) ? user.documents : []
    const updatedDocs = [...existingDocs, ...uploadedMediaIds]

    await db
      .update(usersTable)
      .set({
        documents: updatedDocs,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(usersTable.id, userId))

    return NextResponse.json({ success: true, uploaded: uploadedMediaIds.length })
  } catch (error) {
    console.error('Document upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload documents'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
