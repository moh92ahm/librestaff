import type { Metadata } from 'next'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { additionalPaymentsTable, payrollTable } from '@/db/schema'
import { getScopedUserIds, requirePermission } from '@/lib/permissions'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PayrollList } from '@/components/payroll/payroll-list'

export const metadata: Metadata = {
  title: 'Payroll Records',
  description: 'Manage payroll records and payments',
}

type AdditionalPayment = Awaited<
  ReturnType<typeof db.query.additionalPaymentsTable.findMany>
>[number] & {
  employee?: Awaited<ReturnType<typeof db.query.usersTable.findFirst>>
}

function categoryToPayrollType(category: AdditionalPayment['category']) {
  if (category === 'bonus' || category === 'commission' || category === 'allowance') {
    return category
  }

  return 'other'
}

function toPayrollRow(payment: AdditionalPayment) {
  const amount = Number(payment.amount || 0)

  return {
    id: `additional-${payment.id}`,
    employeeId: payment.employeeId,
    month: payment.month,
    year: payment.year,
    payrollItems: [
      {
        payrollSettingId: payment.id,
        description: payment.description,
        payrollType: categoryToPayrollType(payment.category),
        amount,
        paymentType: payment.paymentType,
      },
    ],
    bonusAmount: '0',
    deductionAmount: '0',
    adjustmentNote: payment.notes,
    totalAmount: String(amount),
    paymentDate: payment.paymentDate,
    paymentReference: null,
    paymentNotes: payment.notes,
    status: payment.status,
    processedById: null,
    processedAt: null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    employee: payment.employee,
    processedBy: null,
    isAdditionalPayment: true,
    additionalCategory: payment.category,
  }
}

export default async function Page() {
  const user = await requirePermission('payroll', 'view')
  const scopedUserIds = await getScopedUserIds(user, 'payroll', 'view')

  if (scopedUserIds !== null && scopedUserIds.length === 0) {
    return (
      <Tabs defaultValue="outline">
        <TabsContent
          value="outline"
          className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
        >
          <div className="space-y-4 p-4 lg:p-6">
            <PayrollList data={[]} />
          </div>
        </TabsContent>
      </Tabs>
    )
  }

  const [payrollDocs, additionalPayments] = await Promise.all([
    db.query.payrollTable.findMany({
      where: scopedUserIds ? inArray(payrollTable.employeeId, scopedUserIds) : undefined,
      orderBy: (payroll, { desc }) => [desc(payroll.updatedAt)],
      limit: 100,
      with: {
        employee: true,
        processedBy: true,
      },
    }),
    db.query.additionalPaymentsTable.findMany({
      where: scopedUserIds
        ? inArray(additionalPaymentsTable.employeeId, scopedUserIds)
        : undefined,
      orderBy: (payments, { desc }) => [desc(payments.updatedAt)],
      limit: 100,
      with: {
        employee: true,
      },
    }),
  ])

  const payrollRows = [...payrollDocs, ...additionalPayments.map(toPayrollRow)].sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  )

  return (
    <Tabs defaultValue="outline">
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="space-y-4 p-4 lg:p-6">
          <PayrollList data={payrollRows as any} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
