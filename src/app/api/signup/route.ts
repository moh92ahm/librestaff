import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { rolesTable, userInvitesTable, usersTable } from '@/db/schema'
import { hashInviteToken } from '@/lib/user-invites'
import { normalizeUsername } from '@/lib/usernames'
import { normalizePhoneNumber } from '@/lib/phone-numbers'
import { normalizeDisplayText } from '@/lib/display-text'
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { createHash, timingSafeEqual } from 'crypto'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)

const signupSchema = z
  .object({
    fullName: z
      .string()
      .transform(normalizeDisplayText)
      .refine((value) => value.length > 0, 'Full name is required'),
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    username: z
      .string()
      .transform(normalizeUsername)
      .refine((value) => value.length >= 3, 'Username must be at least 3 characters'),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
    primaryPhone: z
      .string()
      .transform(normalizePhoneNumber)
      .refine((value) => value.length > 1, 'Phone number is required'),
    birthDate: z.string().trim().min(1, 'Birth date is required'),
    joinedAt: z.string().trim().min(1, 'Joined date is required'),
    nationality: optionalText,
    identityNumber: optionalText,
    address: optionalText,
    inviteToken: z.string().trim().optional(),
    setupSecret: z.string().trim().max(1024).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

const defaultRoles = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access - can manage all users, settings, and data',
  },
  {
    name: 'member',
    displayName: 'Member',
    description: 'Standard access - can view own profile, calendar, and announcements',
  },
] as const

function setupSecretMatches(submittedSecret: string | undefined) {
  const configuredSecret = process.env.SETUP_SECRET
  if (!configuredSecret) throw new Error('SETUP_NOT_CONFIGURED')

  const submittedHash = createHash('sha256')
    .update(submittedSecret || '')
    .digest()
  const configuredHash = createHash('sha256').update(configuredSecret).digest()
  return timingSafeEqual(submittedHash, configuredHash)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid signup data'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const data = parsed.data
    const ip = getClientIp(req)
    const limitKey = [ip, data.email, data.inviteToken || 'first-user'].join(':')
    const limit = await consumeRateLimit({
      scope: 'signup',
      key: limitKey,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })

    if (!limit.allowed) {
      return rateLimitResponse(limit)
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const { user, roleName } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('librestaff_signup_first_user'))`)

      const existingEmail = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, data.email))
        .limit(1)

      if (existingEmail.length > 0) {
        throw new Error('EMAIL_EXISTS')
      }

      const existingUsername = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`lower(${usersTable.username}) = ${data.username}`)
        .limit(1)

      if (existingUsername.length > 0) {
        throw new Error('USERNAME_EXISTS')
      }

      const existingUser = await tx.select({ id: usersTable.id }).from(usersTable).limit(1)
      const isFirstUser = existingUser.length === 0

      if (isFirstUser && !setupSecretMatches(data.setupSecret)) {
        throw new Error('SETUP_SECRET_INVALID')
      }

      let roleName: string = 'admin'
      let roleId: string | null = null
      let inviteId: string | null = null

      for (const role of defaultRoles) {
        const existingRole = await tx
          .select()
          .from(rolesTable)
          .where(eq(rolesTable.name, role.name))
          .limit(1)

        const [roleRecord] =
          existingRole.length > 0
            ? existingRole
            : await tx
                .insert(rolesTable)
                .values({
                  name: role.name,
                  displayName: role.displayName,
                  description: role.description,
                  isSystem: true,
                  isActive: true,
                })
                .returning()

        if (role.name === roleName) {
          roleId = roleRecord.id
        }
      }

      if (!isFirstUser) {
        if (!data.inviteToken) {
          throw new Error('INVITE_REQUIRED')
        }

        const [invite] = await tx
          .select({
            id: userInvitesTable.id,
            email: userInvitesTable.email,
            roleId: userInvitesTable.roleId,
            tokenHash: userInvitesTable.tokenHash,
            expiresAt: userInvitesTable.expiresAt,
            usedAt: userInvitesTable.usedAt,
          })
          .from(userInvitesTable)
          .where(eq(userInvitesTable.tokenHash, hashInviteToken(data.inviteToken)))
          .limit(1)

        if (!invite) {
          throw new Error('INVITE_INVALID')
        }

        if (invite.usedAt) {
          throw new Error('INVITE_USED')
        }

        if (new Date(invite.expiresAt).getTime() <= Date.now()) {
          throw new Error('INVITE_EXPIRED')
        }

        if (invite.email.toLowerCase() !== data.email) {
          throw new Error('INVITE_EMAIL_MISMATCH')
        }

        const [inviteRole] = await tx
          .select({ id: rolesTable.id, name: rolesTable.name })
          .from(rolesTable)
          .where(eq(rolesTable.id, invite.roleId))
          .limit(1)

        if (!inviteRole) {
          throw new Error('ROLE_NOT_FOUND')
        }

        inviteId = invite.id
        roleId = inviteRole.id
        roleName = inviteRole.name
      }

      if (!roleId) {
        throw new Error('ROLE_NOT_FOUND')
      }

      const [user] = await tx
        .insert(usersTable)
        .values({
          fullName: data.fullName,
          email: data.email,
          username: data.username,
          password: hashedPassword,
          primaryPhone: data.primaryPhone,
          birthDate: data.birthDate,
          joinedAt: data.joinedAt,
          employmentStartDate: data.joinedAt,
          nationality: data.nationality,
          identityNumber: data.identityNumber,
          address: data.address,
          personType: 'employee',
          includeInHeadcount: true,
          visibleInTeamDirectory: true,
          roleId,
          isProtectedAdmin: isFirstUser,
        })
        .returning({
          id: usersTable.id,
          fullName: usersTable.fullName,
          email: usersTable.email,
        })

      if (inviteId) {
        await tx
          .update(userInvitesTable)
          .set({ usedAt: new Date().toISOString() })
          .where(eq(userInvitesTable.id, inviteId))
      }

      return { user, roleName }
    })

    return NextResponse.json(
      {
        message:
          roleName === 'admin'
            ? 'Account created successfully. You are the first user, so administrator access was assigned.'
            : 'Account created successfully.',
        user: {
          ...user,
          role: roleName,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }

    if (error instanceof Error && error.message === 'USERNAME_EXISTS') {
      return NextResponse.json(
        { error: 'An account with this username already exists' },
        { status: 409 },
      )
    }

    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json(
        { error: 'An account with this email or username already exists' },
        { status: 409 },
      )
    }

    const inviteErrors: Record<string, { error: string; status: number }> = {
      SETUP_NOT_CONFIGURED: {
        error: 'Initial setup is disabled until SETUP_SECRET is configured',
        status: 503,
      },
      SETUP_SECRET_INVALID: {
        error: 'The setup secret is invalid',
        status: 403,
      },
      INVITE_REQUIRED: {
        error: 'A valid invite link is required to create an account',
        status: 403,
      },
      INVITE_INVALID: { error: 'This invite link is invalid', status: 404 },
      INVITE_USED: { error: 'This invite link has already been used', status: 409 },
      INVITE_EXPIRED: { error: 'This invite link has expired', status: 410 },
      INVITE_EMAIL_MISMATCH: {
        error: 'This invite link was created for a different email address',
        status: 403,
      },
    }

    if (error instanceof Error && error.message in inviteErrors) {
      const response = inviteErrors[error.message]
      return NextResponse.json({ error: response.error }, { status: response.status })
    }

    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
