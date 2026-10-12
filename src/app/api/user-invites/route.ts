import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { rolesTable, userInvitesTable, usersTable } from '@/db/schema'
import { requireAdminAPI } from '@/lib/auth-guards'
import {
  createInviteToken,
  getInviteExpiryDate,
  getSignupInviteUrl,
  hashInviteToken,
  isInviteEmailConfigured,
  sendInviteEmail,
} from '@/lib/user-invites'

const inviteSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  roleId: z.string().trim().min(1, 'Role is required'),
})

export async function POST(request: NextRequest) {
  const currentUser = await requireAdminAPI()

  if (!currentUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  if (!(await isInviteEmailConfigured())) {
    return NextResponse.json(
      { error: 'Email settings are not configured' },
      { status: 503 },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid invite data'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { email, roleId } = parsed.data

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }

    const [role] = await db
      .select({
        id: rolesTable.id,
        name: rolesTable.name,
        displayName: rolesTable.displayName,
        isActive: rolesTable.isActive,
      })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .limit(1)

    if (!role) {
      return NextResponse.json({ error: 'Selected role does not exist' }, { status: 400 })
    }
    if (role.isActive === false && role.name !== 'admin') {
      return NextResponse.json({ error: 'Selected role is inactive' }, { status: 400 })
    }

    const existingInvites = await db
      .select({
        id: userInvitesTable.id,
        expiresAt: userInvitesTable.expiresAt,
        usedAt: userInvitesTable.usedAt,
      })
      .from(userInvitesTable)
      .where(eq(userInvitesTable.email, email))

    const activeInvite = existingInvites.find(
      (invite) => !invite.usedAt && new Date(invite.expiresAt).getTime() > Date.now(),
    )

    if (activeInvite) {
      return NextResponse.json(
        { error: 'There is already an active invite for this email address' },
        { status: 409 },
      )
    }

    const token = createInviteToken()
    const tokenHash = hashInviteToken(token)
    const expiresAt = getInviteExpiryDate().toISOString()
    const inviteUrl = getSignupInviteUrl(token)

    const [invite] = await db
      .insert(userInvitesTable)
      .values({
        email,
        roleId: role.id,
        tokenHash,
        expiresAt,
        invitedBy: currentUser.id,
      })
      .returning({ id: userInvitesTable.id })

    try {
      await sendInviteEmail({ to: email, inviteUrl, expiresAt, locale: currentUser.language })
    } catch (emailError) {
      await db.delete(userInvitesTable).where(eq(userInvitesTable.id, invite.id))
      console.error('Error sending invite email:', emailError)
      return NextResponse.json({ error: 'Failed to send invite email' }, { status: 502 })
    }

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email,
          role: role.displayName,
          expiresAt,
          inviteUrl,
          emailSent: true,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }
}
