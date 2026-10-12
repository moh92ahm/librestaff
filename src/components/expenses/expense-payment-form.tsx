'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { updateExpensePaymentAction } from '@/lib/actions/expenses'
import type { ExpensePaymentRecord, ExpensePaymentStatus } from '@/lib/expenses'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

type EmployeeOption = {
  id: string
  fullName: string
  isActive: boolean
}

const paymentMethodOptions = ['bankTransfer', 'cash', 'cheque', 'creditCard', 'other'] as const
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

function formatDate(value?: string | null, locale = 'en-US') {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' {
  if (status === 'paid') return 'success'
  if (status === 'approved') return 'default'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

function DateField({
  label,
  name,
  defaultValue,
  disabled,
}: {
  label: string
  name: string
  defaultValue?: string | null
  disabled?: boolean
}) {
  const [value, setValue] = React.useState(defaultValue || '')

  return (
    <DatePicker
      label={label}
      name={name}
      value={value}
      onValueChange={setValue}
      disabled={disabled}
    />
  )
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
  disabled,
}: {
  employees: EmployeeOption[]
  defaultChecked?: boolean
  defaultEmployeeId?: string | null
  disabled?: boolean
}) {
  const t = useTranslations('expenses')
  const [checked, setChecked] = React.useState(Boolean(defaultChecked))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="hidden" name="isReimbursable" value={String(checked)} />
        <Switch checked={checked} onCheckedChange={setChecked} disabled={disabled} />
        <Label>{t('isReimbursable')}</Label>
      </div>
      {checked && (
        <div className="space-y-2">
          <Label>{t('employee')}</Label>
          <Select
            name="reimbursableEmployeeId"
            defaultValue={defaultEmployeeId || undefined}
            disabled={disabled}
          >
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

export function ExpensePaymentForm({
  payment,
  employees,
  locale,
}: {
  payment: ExpensePaymentRecord
  employees: EmployeeOption[]
  locale: string
}) {
  const router = useRouter()
  const t = useTranslations('expenses')
  const commonT = useTranslations('common')
  const paymentMethodT = useTranslations('labels.paymentMethods')
  const readOnly = payment.status === 'paid' || payment.status === 'cancelled'
  const [documents, setDocuments] = React.useState<MultiFileUploadValue[]>(
    () => (Array.isArray(payment.documents) ? (payment.documents as MultiFileUploadValue[]) : []),
  )

  return (
    <form
      action={async (formData) => {
        if (readOnly) return
        try {
          await updateExpensePaymentAction(formData)
          notify.success(t('updated'))
          router.push('/expenses')
          router.refresh()
        } catch (error) {
          notify.error(error, t('updateFailed'))
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={payment.id} />

      <EditSection title={t('paymentDetails')}>
        <EditRow title={t('name')} description={t('editHelp.name')}>
          <Input id="detail-name" name="name" required defaultValue={payment.name} disabled={readOnly} />
        </EditRow>

        <EditRow title={t('amount')} description={t('editHelp.amount')}>
          <Input
            id="detail-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={payment.amount}
            disabled={readOnly}
          />
        </EditRow>

        <EditRow title={t('category')} description={t('editHelp.category')}>
          <Select name="category" defaultValue={payment.category || 'other'} disabled={readOnly}>
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
          <Input
            id="detail-vendor"
            name="vendor"
            defaultValue={payment.vendor || ''}
            disabled={readOnly}
          />
        </EditRow>

        <EditRow title={t('paymentMethod')} description={t('editHelp.paymentMethod')}>
          <Select name="paymentMethod" defaultValue={payment.paymentMethod} disabled={readOnly}>
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

        <EditRow title={t('expenseDate')} description={t('editHelp.expenseDate')}>
          <DateField
            label={t('expenseDate')}
            name="generationDate"
            defaultValue={payment.generationDate}
            disabled={readOnly}
          />
        </EditRow>

        {payment.source === 'recurring' && (
          <EditRow title={t('dueDate')} description={t('editHelp.dueDate')}>
            <DateField
              label={t('dueDate')}
              name="dueDate"
              defaultValue={payment.dueDate}
              disabled={readOnly}
            />
          </EditRow>
        )}

        <EditRow title={t('isReimbursable')} description={t('editHelp.isReimbursable')}>
          <ReimbursableFields
            employees={employees}
            defaultChecked={payment.isReimbursable}
            defaultEmployeeId={payment.reimbursableEmployeeId}
            disabled={readOnly}
          />
        </EditRow>

        <EditRow title={t('notes')} description={t('editHelp.notes')}>
          <Textarea id="detail-notes" name="notes" defaultValue={payment.notes || ''} disabled={readOnly} />
        </EditRow>

        {payment.source === 'single' && (
          <EditRow title={t('documents')} description={t('editHelp.documents')}>
            <MultiFileUpload
              value={documents}
              onChange={setDocuments}
              name="documents"
              label=""
              placeholder={t('uploadDocuments')}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              maxFiles={10}
              disabled={readOnly}
            />
          </EditRow>
        )}

        <EditRow title={t('auditDetails')} description={t('editHelp.auditDetails')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">{t('createdAt')}</div>
              <div className="text-sm font-medium">{formatDate(payment.createdAt, locale)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('updatedAt')}</div>
              <div className="text-sm font-medium">{formatDate(payment.updatedAt, locale)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{commonT('status')}</div>
              <Badge variant={statusVariant(payment.status as ExpensePaymentStatus)}>
                {t(payment.status)}
              </Badge>
            </div>
          </div>
        </EditRow>
      </EditSection>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/expenses">{readOnly ? commonT('close') : commonT('cancel')}</Link>
        </Button>
        {!readOnly && <Button type="submit">{commonT('save')}</Button>}
      </div>
    </form>
  )
}
