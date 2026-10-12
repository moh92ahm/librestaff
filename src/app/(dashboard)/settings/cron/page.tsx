import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { CronSettingsForm } from '@/components/settings/cron-settings-form'
import { saveCronJobsAction, runCronJobAction } from '@/lib/actions/cron-jobs'
import { requireAdmin } from '@/lib/auth-guards'
import { getCronSecretStatus, getOrCreateCronJobs } from '@/lib/cron-jobs'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cronSettings')

  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
  }
}

export default async function CronSettingsPage() {
  await requireAdmin()
  const jobs = await getOrCreateCronJobs()

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <CronSettingsForm
          jobs={jobs}
          cronSecretConfigured={getCronSecretStatus()}
          saveAction={saveCronJobsAction}
          runAction={runCronJobAction}
        />
      </div>
    </div>
  )
}
