import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  announcementAttachmentsTable,
  announcementCommentAttachmentsTable,
  announcementCommentsTable,
  applicantsTable,
  expensePaymentsTable,
  inventoryTable,
  leavesTable,
  mediaTable,
  usersTable,
} from '@/db/schema'
import { requireAuthAPI } from '@/lib/auth-guards'
import { canAccessTargetUser, hasPermission } from '@/lib/permissions'
import { getVisibleAnnouncementForUser } from '@/lib/announcements'
import { mediaStoragePath } from '@/lib/media-storage'

function valuesFromJson(value: unknown): string[] {
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

async function canAccessEmployeeMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
  mediaUrl: string,
) {
  const users = await db
    .select({
      id: usersTable.id,
      photo: usersTable.photo,
      documents: usersTable.documents,
    })
    .from(usersTable)

  for (const target of users) {
    const documents = valuesFromJson(target.documents)
    const hasDocument = documents.includes(mediaId) || documents.includes(mediaUrl)
    const hasPhoto = target.photo === mediaUrl || target.photo === mediaId
    if (
      (hasDocument || hasPhoto) &&
      (await canAccessTargetUser(user, 'employees', 'view', target.id))
    ) {
      return true
    }
  }

  return false
}

async function canAccessApplicantMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
) {
  const [applicant] = await db
    .select({ id: applicantsTable.id })
    .from(applicantsTable)
    .where(eq(applicantsTable.cv, mediaId))
    .limit(1)

  return Boolean(applicant) && (await hasPermission(user, 'applicants', 'view'))
}

async function canAccessAnnouncementMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
) {
  const announcementRows = await db
    .select({ announcementId: announcementAttachmentsTable.announcementId })
    .from(announcementAttachmentsTable)
    .where(eq(announcementAttachmentsTable.mediaId, mediaId))

  for (const row of announcementRows) {
    if (await getVisibleAnnouncementForUser(row.announcementId, user)) return true
  }

  const commentRows = await db
    .select({ announcementId: announcementCommentsTable.announcementId })
    .from(announcementCommentAttachmentsTable)
    .innerJoin(
      announcementCommentsTable,
      eq(announcementCommentAttachmentsTable.commentId, announcementCommentsTable.id),
    )
    .where(eq(announcementCommentAttachmentsTable.mediaId, mediaId))

  for (const row of commentRows) {
    if (await getVisibleAnnouncementForUser(row.announcementId, user)) return true
  }

  return false
}

async function canAccessInventoryMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
  mediaUrl: string,
) {
  if (!(await hasPermission(user, 'inventory', 'view'))) return false

  const items = await db.select({ images: inventoryTable.images }).from(inventoryTable)
  return items.some((item) => {
    const images = valuesFromJson(item.images)
    return images.includes(mediaId) || images.includes(mediaUrl)
  })
}

async function canAccessExpenseMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
  mediaUrl: string,
) {
  if (!(await hasPermission(user, 'expenses', 'view'))) return false

  const payments = await db
    .select({ documents: expensePaymentsTable.documents })
    .from(expensePaymentsTable)
  return payments.some((payment) => {
    const documents = valuesFromJson(payment.documents)
    return documents.includes(mediaId) || documents.includes(mediaUrl)
  })
}

async function canAccessLeaveMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
  mediaUrl: string,
) {
  const leaves = await db
    .select({ userId: leavesTable.userId, attachments: leavesTable.attachments })
    .from(leavesTable)

  for (const leave of leaves) {
    const attachments = valuesFromJson(leave.attachments)
    if (
      (attachments.includes(mediaId) || attachments.includes(mediaUrl)) &&
      (await canAccessTargetUser(user, 'leaves', 'view', leave.userId))
    ) {
      return true
    }
  }

  return false
}

async function canAccessMedia(
  user: NonNullable<Awaited<ReturnType<typeof requireAuthAPI>>>,
  mediaId: string,
  mediaUrl: string,
) {
  return (
    (await canAccessApplicantMedia(user, mediaId)) ||
    (await canAccessEmployeeMedia(user, mediaId, mediaUrl)) ||
    (await canAccessAnnouncementMedia(user, mediaId)) ||
    (await canAccessInventoryMedia(user, mediaId, mediaUrl)) ||
    (await canAccessExpenseMedia(user, mediaId, mediaUrl)) ||
    (await canAccessLeaveMedia(user, mediaId, mediaUrl))
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthAPI()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id)).limit(1)
  if (!media) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (media.visibility !== 'public' && !(await canAccessMedia(user, media.id, media.url))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!media.storageKey) {
    return NextResponse.redirect(new URL(media.url, request.url))
  }

  try {
    const file = await readFile(mediaStoragePath(media.storageKey))
    const disposition =
      request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    const filename = media.originalFilename || media.filename

    return new NextResponse(file, {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(media.filesize),
        'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
