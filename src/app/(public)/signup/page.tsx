import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { UserSignupForm } from '@/components/user/forms/user-signup-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db'
import { userInvitesTable, usersTable } from '@/db/schema'
import { hashInviteToken, isInviteExpired } from '@/lib/user-invites'
import { eq } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your LibreStaff account',
}

export const dynamic = 'force-dynamic'

function InvalidInvite({
  title,
  message,
  returnLabel,
}: {
  title: string
  message: string
  returnLabel: string
}) {
  return (
    <main className="min-h-svh bg-gray-50 p-6 md:p-10">
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <a href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {returnLabel}
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>
}) {
  const t = await getTranslations('auth')
  const params = searchParams ? await searchParams : {}
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  const existingUser = await db.select({ id: usersTable.id }).from(usersTable).limit(1)
  const isFirstUser = existingUser.length === 0
  let inviteEmail = ''

  if (!isFirstUser) {
    if (!token) {
      redirect('/login')
    }

    const [invite] = await db
      .select({
        email: userInvitesTable.email,
        expiresAt: userInvitesTable.expiresAt,
        usedAt: userInvitesTable.usedAt,
      })
      .from(userInvitesTable)
      .where(eq(userInvitesTable.tokenHash, hashInviteToken(token)))
      .limit(1)

    if (!invite) {
      return (
        <InvalidInvite
          title={t('inviteUnavailable')}
          message={t('invalidInvite')}
          returnLabel={t('returnToLogin')}
        />
      )
    }

    if (invite.usedAt) {
      return (
        <InvalidInvite
          title={t('inviteUnavailable')}
          message={t('usedInvite')}
          returnLabel={t('returnToLogin')}
        />
      )
    }

    if (isInviteExpired(invite.expiresAt)) {
      return (
        <InvalidInvite
          title={t('inviteUnavailable')}
          message={t('expiredInvite')}
          returnLabel={t('returnToLogin')}
        />
      )
    }

    inviteEmail = invite.email
  }

  return (
    <main className="min-h-svh bg-gray-50 p-6 md:p-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal">
            {isFirstUser ? t('createAdminAccount') : t('createAccount')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isFirstUser
              ? t('firstAdminDescription')
              : t('inviteLockedDescription')}
          </p>
        </div>
        <UserSignupForm initialEmail={inviteEmail} inviteToken={token} emailReadOnly={!isFirstUser} />
      </div>
    </main>
  )
}
