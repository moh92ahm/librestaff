import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { mediaTable, usersTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { canAccessTargetUser, requirePermissionAPI } from '@/lib/permissions'
import { deleteStoredMedia } from '@/lib/media-storage'

function documentValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [value]
    } catch {
      return [value]
    }
  }
  return []
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const actor = await requirePermissionAPI('employees', 'edit')
    if (!actor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: userId, docId } = await params
    if (!(await canAccessTargetUser(actor, 'employees', 'edit', userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current user documents list
    const [user] = await db
      .select({ id: usersTable.id, documents: usersTable.documents })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the media record
    const [media] = await db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.id, docId))
      .limit(1)

    if (!media) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const existingDocs = documentValues(user.documents)
    const isAttachedToUser = existingDocs.includes(docId) || existingDocs.includes(media.url)
    if (!isAttachedToUser) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Remove from filesystem
    await deleteStoredMedia(media.storageKey)

    // Remove from media table
    await db.delete(mediaTable).where(eq(mediaTable.id, docId))

    // Remove media ID from user's documents array
    const updatedDocs = existingDocs.filter((id) => id !== docId && id !== media.url)

    await db
      .update(usersTable)
      .set({
        documents: updatedDocs,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(usersTable.id, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Document delete error:', error)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
