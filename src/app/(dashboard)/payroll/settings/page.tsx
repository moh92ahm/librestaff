import type { Metadata } from 'next'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'
import { payrollSettingsTable } from '@/db/schema'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PayrollSettingsList } from '@/components/payroll/settings/payroll-settings-list'

export const metadata: Metadata = {
  title: 'Payroll Settings',
  description: 'Manage employee payroll configurations',
}

export default async function PayrollSettingsPage() {
  const user = await requirePermission('payroll', 'view')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'view')

  // Fetch payroll settings with employee relation
  const payrollSettings = await db.query.payrollSettingsTable.findMany({
    where: scopedUserIds ? inArray(payrollSettingsTable.employeeId, scopedUserIds) : undefined,
    orderBy: (settings, { desc }) => [desc(settings.createdAt)],
    limit: 1000,
    with: {
      employee: true,
    },
  })

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <PayrollSettingsList data={payrollSettings as any} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
