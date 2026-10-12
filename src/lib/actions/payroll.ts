'use server'

import { redirect } from 'next/navigation'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'
import { setFlashToast } from '@/lib/flash-toast'
import { generatePayrollsForPeriod, toPayrollMonth } from '@/lib/payroll-generation'

export async function generatePayrollsAction(formData: FormData) {
  const actor = await requirePermission('payroll', 'create')
  const scopedUserIds = await getScopedUserIds(actor, 'payroll', 'create')

  const month = toPayrollMonth(String(formData.get('month') || new Date().getMonth() + 1))
  const year = Number(formData.get('year') || new Date().getFullYear())

  if (!Number.isFinite(year)) {
    throw new Error('Invalid payroll year.')
  }

  await generatePayrollsForPeriod({ month, year, scopedUserIds, actorUserId: actor.id })

  await setFlashToast('success', 'Payroll generated')
  redirect('/payroll')
}
