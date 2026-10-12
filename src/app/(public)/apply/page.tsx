import type { Metadata } from 'next'
import { ApplyForm } from '@/components/applicants/apply-form'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Apply for a Position',
  description: 'Submit your application to join our team',
}

export default async function ApplyPage() {
  const t = await getTranslations('publicApply')
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {t('pageTitle')}
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              {t('pageDescription')}
            </p>
          </div>

          {/* Form */}
          <ApplyForm />
        </div>
      </div>
    </div>
  )
}
