import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { getLocale, getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { expensePaymentsTable, mediaTable, usersTable } from '@/db/schema'
import { ExpenseFormPage } from '@/components/expenses/expense-form'
import { ExpensePaymentForm } from '@/components/expenses/expense-payment-form'
import { requirePermission } from '@/lib/permissions'

export const metadata: Metadata = {
  title: 'Expense Payment Details',
  description: 'Review or update a generated expense payment',
}

interface EditExpensePaymentPageProps {
  params: Promise<{ id: string }>
}

export default async function EditExpensePaymentPage({ params }: EditExpensePaymentPageProps) {
  const { id } = await params
  await requirePermission('expenses', 'view')
  const [t, locale] = await Promise.all([getTranslations('expenses'), getLocale()])

  const [payment, employees] = await Promise.all([
    db.query.expensePaymentsTable.findFirst({
      where: eq(expensePaymentsTable.id, id),
    }),
    db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.personType, 'employee'))
      .orderBy(asc(usersTable.fullName)),
  ])

  if (!payment) {
    notFound()
  }

  const documentIds = Array.isArray(payment.documents)
    ? Array.from(new Set(payment.documents.map((documentId) => String(documentId))))
    : []
  const media =
    documentIds.length > 0
      ? await db.select().from(mediaTable).where(inArray(mediaTable.id, documentIds))
      : []
  const mediaById = new Map(media.map((item) => [item.id, item]))
  const hydratedPayment = {
    ...payment,
    documents: documentIds.map((documentId) => {
      const document = mediaById.get(documentId)
      if (!document) return documentId
      return {
        id: document.id,
        filename: document.originalFilename || document.filename,
        filesize: document.filesize,
        mimeType: document.mimeType,
        url: document.url,
      }
    }),
  }

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 lg:p-6">
        <ExpenseFormPage title={t('transactionDetails')} description={t('transactionsDescription')}>
          <ExpensePaymentForm payment={hydratedPayment as any} employees={employees} locale={locale} />
        </ExpenseFormPage>
      </div>
    </div>
  )
}
