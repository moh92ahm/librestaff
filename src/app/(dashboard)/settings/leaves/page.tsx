import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { requireAdmin } from '@/lib/auth-guards'
import { leaveEntitlementTiersTable, leavePolicySettingsTable } from '@/db/schema'
import { LeaveSettingsPanel } from '@/components/leaves/settings/leave-settings-panel'
import { getLeavePolicyConfig } from '@/lib/leave-policy-db'
import { eq } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Leave Settings',
  description: 'Manage leave policy and annual leave entitlement tiers',
}

function parseBoolean(value: FormDataEntryValue | null) {
  return String(value || '') === 'true'
}

function parseDailyRateBasis(value: FormDataEntryValue | null) {
  const raw = String(value || '')
  return raw === 'fixed30' || raw === 'calendarDays' ? raw : 'workingDays'
}

function parseUnpaidDayBasis(value: FormDataEntryValue | null) {
  return String(value || '') === 'calendarDays' ? 'calendarDays' : 'leavePolicy'
}

function parsePositiveInteger(value: FormDataEntryValue | null, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback
}

function parseOptionalPositiveInteger(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const number = Number(raw)
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null
}

export default async function LeaveSettingsPage() {
  await requireAdmin()
  const { settings, tiers } = await getLeavePolicyConfig()

  const updatePolicyAction = async (formData: FormData) => {
    'use server'

    await requireAdmin()
    const id = String(formData.get('id') || '')

    await db
      .update(leavePolicySettingsTable)
      .set({
        carryoverLimitDays: parseOptionalPositiveInteger(formData.get('carryoverLimitDays')),
        countSaturday: parseBoolean(formData.get('countSaturday')),
        countSunday: parseBoolean(formData.get('countSunday')),
        countHolidays: parseBoolean(formData.get('countHolidays')),
        allowNegativeBalance: parseBoolean(formData.get('allowNegativeBalance')),
        unpaidLeaveDeductionEnabled: parseBoolean(formData.get('unpaidLeaveDeductionEnabled')),
        unpaidLeaveDeductionDailyRateBasis: parseDailyRateBasis(
          formData.get('unpaidLeaveDeductionDailyRateBasis'),
        ),
        unpaidLeaveDeductionDayBasis: parseUnpaidDayBasis(
          formData.get('unpaidLeaveDeductionDayBasis'),
        ),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leavePolicySettingsTable.id, id))

    revalidatePath('/leaves')
    revalidatePath('/settings/leaves')
  }

  const saveTierAction = async (formData: FormData) => {
    'use server'

    await requireAdmin()
    const id = String(formData.get('id') || '')
    const values = {
      minimumServiceMonths: parsePositiveInteger(formData.get('minimumServiceMonths'), 12),
      days: parsePositiveInteger(formData.get('days'), 0),
      label: String(formData.get('label') || '').trim() || 'Entitlement tier',
      isActive: parseBoolean(formData.get('isActive')),
      updatedAt: new Date().toISOString(),
    }

    if (id) {
      await db
        .update(leaveEntitlementTiersTable)
        .set(values)
        .where(eq(leaveEntitlementTiersTable.id, id))
    } else {
      await db.insert(leaveEntitlementTiersTable).values({
        ...values,
        createdAt: new Date().toISOString(),
      })
    }

    revalidatePath('/leaves')
    revalidatePath('/settings/leaves')
  }

  const deleteTierAction = async (formData: FormData) => {
    'use server'

    await requireAdmin()
    const id = String(formData.get('id') || '')

    if (id) {
      await db.delete(leaveEntitlementTiersTable).where(eq(leaveEntitlementTiersTable.id, id))
    }

    revalidatePath('/leaves')
    revalidatePath('/settings/leaves')
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <LeaveSettingsPanel
          settings={settings}
          tiers={tiers}
          updatePolicyAction={updatePolicyAction}
          saveTierAction={saveTierAction}
          deleteTierAction={deleteTierAction}
        />
      </div>
    </div>
  )
}
