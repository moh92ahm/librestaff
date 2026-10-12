'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-guards'
import {
  saveCronJobsFromForm,
  runCronJobNow,
  type CronActionState,
} from '@/lib/cron-jobs'
import { isCronJobId, type CronJobId } from '@/lib/cron-schedule'

export async function saveCronJobsAction(
  _previousState: CronActionState,
  formData: FormData,
): Promise<CronActionState> {
  await requireAdmin()

  try {
    await saveCronJobsFromForm(formData)
    revalidatePath('/settings/cron')
    return { status: 'success', message: 'Cron job settings saved.' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Cron job settings could not be saved.',
    }
  }
}

export async function runCronJobAction(
  jobId: CronJobId,
  _previousState: CronActionState,
  formData: FormData,
): Promise<CronActionState> {
  await requireAdmin()

  if (!isCronJobId(jobId)) {
    return { status: 'error', message: 'Unknown cron job.' }
  }

  try {
    const result = await runCronJobNow(jobId, {
      date: String(formData.get('date') || '').trim() || null,
      month: String(formData.get('month') || '').trim() || null,
      year: String(formData.get('year') || '').trim() || null,
      limit: String(formData.get('limit') || '').trim() || null,
    })
    revalidatePath('/settings/cron')
    return {
      status: 'success',
      message: `${jobId} completed: ${JSON.stringify(result)}`,
    }
  } catch (error) {
    revalidatePath('/settings/cron')
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Cron job failed.',
    }
  }
}
