import { LoginForm } from "@/components/login-form"
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { getCompanyBranding } from '@/lib/company-settings'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [existingUser, branding] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).limit(1),
    getCompanyBranding(),
  ])

  if (existingUser.length === 0) {
    redirect('/signup')
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm companyName={branding.companyName} logoUrl={branding.logoUrl} />
      </div>
    </div>
  )
}
