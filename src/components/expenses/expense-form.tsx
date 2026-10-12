'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/date-picker'
import { MultiFileUpload, type MultiFileUploadValue } from '@/components/ui/multi-file-upload'
import { notify } from '@/lib/notify'
import type { ExpenseBillingCycle, ExpensePaymentSource, ExpenseRecord } from '@/lib/expenses'
import { useTranslations } from 'next-intl'

type EmployeeOption = {
  id: string
  fullName: string
  isActive: boolean
}

const paymentMethodOptions = ['bankTransfer', 'cash', 'cheque', 'creditCard', 'other'] as const
const billingCycleOptions: ExpenseBillingCycle[] = ['monthly', 'quarterly', 'sixMonthly', 'yearly']
const categoryOptions = [
  'groceries',
  'laptop',
  'office supplies',
  'travel',
  'software',
  'utilities',
  'rent',
  'payroll',
  'other',
]

function formatCategoryLabel(category: string) {
  return category
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string
  name: string
  defaultValue?: string | null
}) {
  const [value, setValue] = React.useState(defaultValue || '')

  return <DatePicker label={label} name={name} value={value} onValueChange={setValue} />
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  )
}

function EditRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function ReimbursableFields({
  employees,
  defaultChecked,
  defaultEmployeeId,
}: {
  employees: EmployeeOption[]
  defaultChecked?: boolean
  defaultEmployeeId?: string | null
}) {
  const t = useTranslations('expenses')
  const [checked, setChecked] = React.useState(Boolean(defaultChecked))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="hidden" name="isReimbursable" value={String(checked)} />
        <Switch checked={checked} onCheckedChange={setChecked} />
        <Label>{t('isReimbursable')}</Label>
      </div>
      {checked && (
        <div className="space-y-2">
          <Label>{t('employee')}</Label>
          <Select name="reimbursableEmployeeId" defaultValue={defaultEmployeeId || undefined}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectEmployee')} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

export function ExpenseForm({
  action,
  employees,
  expense,
  fixedSource,
}: {
  action: (formData: FormData) => Promise<void>
  employees: EmployeeOption[]
  expense?: ExpenseRecord | null
  fixedSource?: ExpensePaymentSource
}) {
  const router = useRouter()
  const t = useTranslations('expenses')
  const commonT = useTranslations('common')
  const paymentMethodT = useTranslations('labels.paymentMethods')
  const today = new Date().toISOString().slice(0, 10)
  const [source, setSource] = React.useState<ExpensePaymentSource>(fixedSource || 'single')
  const [billingCycle, setBillingCycle] = React.useState<ExpenseBillingCycle>(
    expense?.billingCycle || 'monthly',
  )
  const [isActive, setIsActive] = React.useState(expense?.isActive ?? true)
  const [documents, setDocuments] = React.useState<MultiFileUploadValue[]>([])
  const defaultGenerationDate = expense?.startDate || today

  return (
    <form
      action={async (formData) => {
        try {
          await action(formData)
          notify.success(expense ? t('updated') : t('created'))
          router.push('/expenses')
          router.refresh()
        } catch (error) {
          notify.error(error, expense ? t('updateFailed') : t('createFailed'))
        }
      }}
      className="space-y-4"
    >
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="billingCycle" value={billingCycle} />
      <input type="hidden" name="isActive" value={String(isActive)} />

      <EditSection title={t('paymentDetails')}>
        {!fixedSource && (
          <EditRow title={t('paymentSource')} description={t('editHelp.paymentSource')}>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as ExpensePaymentSource)}
            >
              <SelectTrigger className="w-full md:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">{t('single')}</SelectItem>
                <SelectItem value="recurring">{t('recurring')}</SelectItem>
              </SelectContent>
            </Select>
          </EditRow>
        )}

        <EditRow title={t('name')} description={t('editHelp.name')}>
          <Input id="name" name="name" required defaultValue={expense?.name || ''} />
        </EditRow>

        <EditRow title={t('amount')} description={t('editHelp.amount')}>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={expense?.amount || ''}
          />
        </EditRow>

        <EditRow title={t('category')} description={t('editHelp.category')}>
          <Select name="category" defaultValue={expense?.category || 'other'}>
            <SelectTrigger className="w-full md:max-w-xs">
              <SelectValue placeholder={t('selectCategories')} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {formatCategoryLabel(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditRow>

        <EditRow title={t('vendor')} description={t('editHelp.vendor')}>
          <Input id="vendor" name="vendor" defaultValue={expense?.vendor || ''} />
        </EditRow>

        <EditRow title={t('paymentMethod')} description={t('editHelp.paymentMethod')}>
          <Select name="paymentMethod" defaultValue={expense?.paymentMethod || 'bankTransfer'}>
            <SelectTrigger className="w-full md:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === 'creditCard' ? t('creditCard') : paymentMethodT(option as any)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditRow>

        <datalist id="expense-categories">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
        </datalist>

        {source === 'recurring' && (
          <EditRow title={t('dueOffsetDays')} description={t('editHelp.dueOffsetDays')}>
            <Input
              id="dueOffsetDays"
              name="dueOffsetDays"
              type="number"
              min="1"
              max="90"
              defaultValue={expense?.dueOffsetDays || 7}
              className="md:max-w-xs"
            />
          </EditRow>
        )}

        {source === 'single' ? (
          <>
            <EditRow title={t('expenseDate')} description={t('editHelp.expenseDate')}>
              <DateField label={t('expenseDate')} name="generationDate" defaultValue={today} />
            </EditRow>
            <EditRow title={t('documents')} description={t('editHelp.documents')}>
              <MultiFileUpload
                value={documents}
                onChange={setDocuments}
                name="documents"
                label=""
                placeholder={t('uploadDocuments')}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                maxFiles={10}
              />
            </EditRow>
          </>
        ) : (
          <>
            <EditRow title={t('billingCycle')} description={t('editHelp.billingCycle')}>
              <Select
                value={billingCycle}
                onValueChange={(value) => setBillingCycle(value as ExpenseBillingCycle)}
              >
                <SelectTrigger className="w-full md:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {billingCycleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditRow>
            <EditRow title={t('startingDate')} description={t('editHelp.startingDate')}>
              <DateField
                label={t('startingDate')}
                name="startDate"
                defaultValue={defaultGenerationDate}
              />
            </EditRow>
            <EditRow title={t('activeRecurring')} description={t('editHelp.activeRecurring')}>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{t('activeRecurring')}</Label>
              </div>
            </EditRow>
          </>
        )}

        <EditRow title={t('isReimbursable')} description={t('editHelp.isReimbursable')}>
          <ReimbursableFields
            employees={employees}
            defaultChecked={expense?.isReimbursable}
            defaultEmployeeId={expense?.reimbursableEmployeeId}
          />
        </EditRow>

        <EditRow title={t('notes')} description={t('editHelp.notes')}>
          <Textarea id="notes" name="notes" defaultValue={expense?.notes || ''} />
        </EditRow>
      </EditSection>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/expenses">{commonT('cancel')}</Link>
        </Button>
        <Button type="submit">{expense ? t('updateExpense') : t('createExpense')}</Button>
      </div>
    </form>
  )
}

export function ExpenseFormPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  const commonT = useTranslations('common')

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/expenses" aria-label={commonT('back')}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
