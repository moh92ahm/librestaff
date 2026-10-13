import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { UserSignupForm } from '@/components/user/forms/user-signup-form'

export const metadata: Metadata = {
  title: 'Set up LibreStaff',
  description: 'Create the initial LibreStaff administrator account',
}

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const existingUser = await db.select({ id: usersTable.id }).from(usersTable).limit(1)
  if (existingUser.length > 0) redirect('/login')

  const t = await getTranslations('auth')

  return (
    <main className="min-h-svh bg-gray-50 p-6 md:p-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-normal">{t('setupTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('setupDescription')}</p>
        </div>
        <UserSignupForm setupMode />
      </div>
    </main>
  )
}
