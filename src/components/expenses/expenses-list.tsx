'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DateRangePicker } from '@/components/date-range-picker'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  deleteExpenseAction,
  deleteExpensePaymentAction,
  updateExpensePaymentStatusAction,
} from '@/lib/actions/expenses'
import {
  getCurrentMonthKey,
  getExpenseDueDate,
  getExpenseGenerationDate,
  parseMonthKey,
  toAmount,
  type ExpensePaymentRecord,
  type ExpensePaymentSource,
  type ExpensePaymentStatus,
  type ExpenseRecord,
  type PayrollExpenseRecord,
} from '@/lib/expenses'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

type EmployeeOption = {
  id: string
  fullName: string
  isActive: boolean
}

type TransactionRow = {
  id: string
  source: 'payroll' | ExpensePaymentSource
  status: ExpensePaymentStatus
  name: string
  category: string
  amount: number
  paymentMethod: string
  period: string
  generationDate: string
  dueDate: string
  createdAt: string
  updatedAt: string
  isReimbursable: boolean
  employeeName: string
  payment?: ExpensePaymentRecord
  locked: boolean
}

interface ExpensesListProps {
  expenses: ExpenseRecord[]
  payments: ExpensePaymentRecord[]
  payroll: PayrollExpenseRecord[]
  employees: EmployeeOption[]
}

const statusOptions: ExpensePaymentStatus[] = ['generated', 'approved', 'paid', 'cancelled']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(value)
}

function formatDate(value?: string | null, locale = 'en-US') {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthLabel(
  month: string | null | undefined,
  year: number | null | undefined,
  locale = 'en-US',
) {
  if (!month || !year) return '-'
  return parseMonthKey(`${year}-${month.padStart(2, '0')}`, locale).label
}

function shiftDateMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function getMonthRange(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const end = new Date(year, month + 1, 0)
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  }
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' {
  if (status === 'paid') return 'success'
  if (status === 'approved') return 'default'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

function MultiSelectFilter({
  label,
  placeholder,
  values,
  options,
  onChange,
}: {
  label: string
  placeholder: string
  values: string[]
  options: Array<{ value: string; label: string }>
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedOptions = options.filter((option) => values.includes(option.value))

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="min-h-9 w-full justify-between">
            <span className="flex min-w-0 flex-wrap gap-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <Badge key={option.value} variant="secondary">
                    {option.label}
                    <span
                      className="ml-1 rounded-full"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleValue(option.value)
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <X className="size-3" />
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        values.includes(option.value) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function ExpensesList({ expenses, payments, payroll, employees }: ExpensesListProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('expenses')
  const commonT = useTranslations('common')
  const paymentMethodT = useTranslations('labels.paymentMethods')
  const [isPending, startTransition] = React.useTransition()
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [deletingExpense, setDeletingExpense] = React.useState<ExpenseRecord | null>(null)
  const [deletingPayment, setDeletingPayment] = React.useState<ExpensePaymentRecord | null>(null)
  const [statusChange, setStatusChange] = React.useState<{
    payment: ExpensePaymentRecord
    status: ExpensePaymentStatus
  } | null>(null)
  const [filterStartDate, setFilterStartDate] = React.useState('')
  const [filterEndDate, setFilterEndDate] = React.useState('')
  const [quickMonthFilter, setQuickMonthFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<ExpensePaymentStatus[]>([])
  const [sourceFilter, setSourceFilter] = React.useState<Array<'payroll' | ExpensePaymentSource>>(
    [],
  )
  const [categoryFilter, setCategoryFilter] = React.useState<string[]>([])
  const [reimbursableFilter, setReimbursableFilter] = React.useState<string[]>([])
  const [employeeFilter, setEmployeeFilter] = React.useState<string[]>([])
  const [recurringStatusFilter, setRecurringStatusFilter] = React.useState('all')
  const [recurringCycleFilter, setRecurringCycleFilter] = React.useState('all')
  const [transactionPageIndex, setTransactionPageIndex] = React.useState(0)
  const [transactionPageSize, setTransactionPageSize] = React.useState(20)
  const [recurringPageIndex, setRecurringPageIndex] = React.useState(0)
  const [recurringPageSize, setRecurringPageSize] = React.useState(20)

  const employeeById = React.useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )

  const categories = React.useMemo(() => {
    const values = new Set(payments.map((payment) => payment.category))
    values.add('payroll')
    return Array.from(values).sort()
  }, [payments])
  const quickMonthOptions = React.useMemo(
    () =>
      [
        { offset: 0, label: t('thisMonth') },
        { offset: -1, label: t('lastMonth') },
        ...[-2].map((offset) => ({
          offset,
          label: parseMonthKey(getMonthRange(shiftDateMonth(new Date(), offset)).key, locale).label,
        })),
      ].map((item) => ({
        ...getMonthRange(shiftDateMonth(new Date(), item.offset)),
        label: item.label,
      })),
    [locale, t],
  )

  const statusFilterOptions = React.useMemo(
    () => statusOptions.map((status) => ({ value: status, label: t(status) })),
    [t],
  )
  const sourceFilterOptions = React.useMemo(
    () => [
      { value: 'payroll', label: t('payroll') },
      { value: 'single', label: t('single') },
      { value: 'recurring', label: t('recurring') },
    ],
    [t],
  )
  const categoryFilterOptions = React.useMemo(
    () => categories.map((category) => ({ value: category, label: category })),
    [categories],
  )
  const reimbursableFilterOptions = React.useMemo(
    () => [
      { value: 'yes', label: commonT('yes') },
      { value: 'no', label: commonT('no') },
    ],
    [commonT],
  )
  const employeeFilterOptions = React.useMemo(
    () => employees.map((employee) => ({ value: employee.id, label: employee.fullName })),
    [employees],
  )

  const transactions = React.useMemo<TransactionRow[]>(() => {
    const paymentRows = payments.map((payment) => {
      const employee = payment.reimbursableEmployeeId
        ? employeeById.get(payment.reimbursableEmployeeId)
        : null
      return {
        id: `expense-${payment.id}`,
        source: payment.source,
        status: payment.status,
        name: payment.name,
        category: payment.category,
        amount: toAmount(payment.amount),
        paymentMethod: payment.paymentMethod,
        period: formatMonthLabel(payment.expenseMonth, payment.expenseYear, locale),
        generationDate: payment.generationDate,
        dueDate: payment.dueDate,
        createdAt: payment.createdAt || '',
        updatedAt: payment.updatedAt || payment.createdAt || '',
        isReimbursable: payment.isReimbursable,
        employeeName: employee?.fullName || '-',
        payment,
        locked: payment.status === 'paid' || payment.status === 'cancelled',
      }
    })

    const payrollRows = payroll.map((item) => ({
      id: item.id,
      source: 'payroll' as const,
      status: 'paid' as const,
      name: item.employee?.fullName || t('payroll'),
      category: t('payroll'),
      amount: toAmount(item.totalAmount),
      paymentMethod: 'payroll',
      period: formatMonthLabel(item.month, item.year, locale),
      generationDate: `${item.year}-${String(item.month).padStart(2, '0')}-01`,
      dueDate: '-',
      createdAt: '',
      updatedAt: '',
      isReimbursable: false,
      employeeName: item.employee?.fullName || '-',
      locked: true,
    }))

    return [...paymentRows, ...payrollRows].sort((a, b) => {
      const updated = b.updatedAt.localeCompare(a.updatedAt)
      if (updated !== 0) return updated
      return b.generationDate.localeCompare(a.generationDate)
    })
  }, [employeeById, locale, payments, payroll, t])

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((row) => {
      const rowDate = row.createdAt.slice(0, 10)
      if (filterStartDate && (!rowDate || rowDate < filterStartDate)) return false
      if (filterEndDate && (!rowDate || rowDate > filterEndDate)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(row.status)) return false
      if (sourceFilter.length > 0 && !sourceFilter.includes(row.source)) return false
      if (categoryFilter.length > 0 && !categoryFilter.includes(row.category)) return false
      if (
        reimbursableFilter.length > 0 &&
        !reimbursableFilter.includes(row.isReimbursable ? 'yes' : 'no')
      ) {
        return false
      }
      if (
        employeeFilter.length > 0 &&
        (!row.payment?.reimbursableEmployeeId ||
          !employeeFilter.includes(row.payment.reimbursableEmployeeId))
      ) {
        return false
      }
      return true
    })
  }, [
    categoryFilter,
    employeeFilter,
    filterEndDate,
    filterStartDate,
    reimbursableFilter,
    sourceFilter,
    statusFilter,
    transactions,
  ])

  const transactionPageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / transactionPageSize),
  )
  const safeTransactionPageIndex = Math.min(transactionPageIndex, transactionPageCount - 1)
  const transactionStart = safeTransactionPageIndex * transactionPageSize
  const transactionEnd = transactionStart + transactionPageSize
  const paginatedTransactions = filteredTransactions.slice(transactionStart, transactionEnd)
  const canPreviousTransactionPage = safeTransactionPageIndex > 0
  const canNextTransactionPage = safeTransactionPageIndex < transactionPageCount - 1

  React.useEffect(() => {
    const newPageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionPageSize))
    if (transactionPageIndex > newPageCount - 1) {
      setTransactionPageIndex(newPageCount - 1)
    }
  }, [filteredTransactions.length, transactionPageIndex, transactionPageSize])

  const filteredExpenses = React.useMemo(
    () =>
      expenses.filter((expense) => {
        if (recurringStatusFilter === 'active' && !expense.isActive) return false
        if (recurringStatusFilter === 'inactive' && expense.isActive) return false
        if (recurringCycleFilter !== 'all' && expense.billingCycle !== recurringCycleFilter) {
          return false
        }
        return true
      }),
    [expenses, recurringCycleFilter, recurringStatusFilter],
  )

  const recurringPageCount = Math.max(1, Math.ceil(filteredExpenses.length / recurringPageSize))
  const safeRecurringPageIndex = Math.min(recurringPageIndex, recurringPageCount - 1)
  const recurringStart = safeRecurringPageIndex * recurringPageSize
  const recurringEnd = recurringStart + recurringPageSize
  const paginatedExpenses = filteredExpenses.slice(recurringStart, recurringEnd)
  const canPreviousRecurringPage = safeRecurringPageIndex > 0
  const canNextRecurringPage = safeRecurringPageIndex < recurringPageCount - 1

  React.useEffect(() => {
    const newPageCount = Math.max(1, Math.ceil(filteredExpenses.length / recurringPageSize))
    if (recurringPageIndex > newPageCount - 1) {
      setRecurringPageIndex(newPageCount - 1)
    }
  }, [filteredExpenses.length, recurringPageIndex, recurringPageSize])

  function submitStatusChange() {
    if (!statusChange) return
    const formData = new FormData()
    formData.set('id', statusChange.payment.id)
    formData.set('status', statusChange.status)
    startTransition(async () => {
      try {
        await updateExpensePaymentStatusAction(formData)
        notify.success(t('statusUpdated'))
        setStatusChange(null)
      } catch (error) {
        notify.error(error, t('statusUpdateFailed'))
      }
    })
  }

  function paymentMethodLabel(value: string) {
    if (value === 'creditCard') return t('creditCard')
    if (value === 'payroll') return t('payroll')
    return paymentMethodT(value as any)
  }

  const activeFilterCount = [
    filterStartDate || filterEndDate ? 1 : 0,
    statusFilter.length,
    sourceFilter.length,
    categoryFilter.length,
    reimbursableFilter.length,
    employeeFilter.length,
  ].reduce((sum, count) => sum + count, 0)

  function resetFilters() {
    setFilterStartDate('')
    setFilterEndDate('')
    setQuickMonthFilter('')
    setStatusFilter([])
    setSourceFilter([])
    setCategoryFilter([])
    setReimbursableFilter([])
    setEmployeeFilter([])
    setTransactionPageIndex(0)
  }

  function applyQuickMonth(option: { key: string; start: string; end: string }) {
    if (quickMonthFilter === option.key) {
      setQuickMonthFilter('')
      setFilterStartDate('')
      setFilterEndDate('')
    } else {
      setQuickMonthFilter(option.key)
      setFilterStartDate(option.start)
      setFilterEndDate(option.end)
    }
    setTransactionPageIndex(0)
  }

  function updateFilterStartDate(value: string) {
    setFilterStartDate(value)
    setQuickMonthFilter('')
    setTransactionPageIndex(0)
  }

  function updateFilterEndDate(value: string) {
    setFilterEndDate(value)
    setQuickMonthFilter('')
    setTransactionPageIndex(0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('transactionsDescription')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="h-4 w-4" />
              {t('newPayment')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">{t('transactions')}</TabsTrigger>
          <TabsTrigger value="recurrings">{t('recurrings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('transactions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ButtonGroup className="grid w-full grid-cols-3 overflow-hidden sm:flex sm:w-auto">
                  {quickMonthOptions.map((option) => (
                    <Button
                      key={option.key}
                      type="button"
                      size="sm"
                      variant={quickMonthFilter === option.key ? 'default' : 'outline'}
                      className="min-w-0 px-2 text-xs sm:shrink-0 sm:px-3 sm:text-sm"
                      onClick={() => applyQuickMonth(option)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
                <div className="flex justify-end">
                  <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto">
                        <SlidersHorizontal className="h-4 w-4" />
                        {t('filters')}
                        {activeFilterCount > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{t('filters')}</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DateRangePicker
                          label={t('createdAtRange')}
                          startValue={filterStartDate}
                          endValue={filterEndDate}
                          onStartValueChange={updateFilterStartDate}
                          onEndValueChange={updateFilterEndDate}
                        />
                        <MultiSelectFilter
                          label={commonT('status')}
                          placeholder={t('selectStatuses')}
                          values={statusFilter}
                          options={statusFilterOptions}
                          onChange={(values) => setStatusFilter(values as ExpensePaymentStatus[])}
                        />
                        <MultiSelectFilter
                          label={t('paymentSource')}
                          placeholder={t('selectSources')}
                          values={sourceFilter}
                          options={sourceFilterOptions}
                          onChange={(values) =>
                            setSourceFilter(values as Array<'payroll' | ExpensePaymentSource>)
                          }
                        />
                        <MultiSelectFilter
                          label={t('category')}
                          placeholder={t('selectCategories')}
                          values={categoryFilter}
                          options={categoryFilterOptions}
                          onChange={setCategoryFilter}
                        />
                        <MultiSelectFilter
                          label={t('isReimbursable')}
                          placeholder={t('selectReimbursable')}
                          values={reimbursableFilter}
                          options={reimbursableFilterOptions}
                          onChange={setReimbursableFilter}
                        />
                        <MultiSelectFilter
                          label={t('employee')}
                          placeholder={t('selectEmployees')}
                          values={employeeFilter}
                          options={employeeFilterOptions}
                          onChange={setEmployeeFilter}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={resetFilters}>
                          {t('resetFilters')}
                        </Button>
                        <DialogClose asChild>
                          <Button type="button">{commonT('close')}</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('paymentSource')}</TableHead>
                      <TableHead>{t('name')}</TableHead>
                      <TableHead>{t('category')}</TableHead>
                      <TableHead>{t('period')}</TableHead>
                      <TableHead>{t('amount')}</TableHead>
                      <TableHead>{t('paymentMethod')}</TableHead>
                      <TableHead>{t('createdAt')}</TableHead>
                      <TableHead>{t('updatedAt')}</TableHead>
                      <TableHead>{commonT('status')}</TableHead>
                      <TableHead className="text-right">{commonT('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((row) => (
                      <TableRow
                        key={row.id}
                        className={row.payment ? 'cursor-pointer hover:bg-muted/50' : undefined}
                        onClick={() => {
                          if (row.payment) router.push(`/expenses/payments/${row.payment.id}/edit`)
                        }}
                      >
                        <TableCell>
                          <Badge variant={row.source === 'payroll' ? 'secondary' : 'outline'}>
                            {row.source === 'payroll' ? t('payroll') : t(row.source)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.period}</TableCell>
                        <TableCell>{formatCurrency(row.amount)}</TableCell>
                        <TableCell>{paymentMethodLabel(row.paymentMethod)}</TableCell>
                        <TableCell>{formatDate(row.createdAt, locale)}</TableCell>
                        <TableCell>{formatDate(row.updatedAt, locale)}</TableCell>
                        <TableCell>
                          {row.payment && !row.locked ? (
                            <div onClick={(event) => event.stopPropagation()}>
                              <Select
                                value={row.status}
                                onValueChange={(status) => {
                                  if (status === row.status) return
                                  setStatusChange({
                                    payment: row.payment!,
                                    status: status as ExpensePaymentStatus,
                                  })
                                }}
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {t(status)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge variant={statusVariant(row.status)}>{t(row.status)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {row.payment && (
                              <>
                                {row.locked ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="icon" asChild>
                                    <Link
                                      href={`/expenses/payments/${row.payment.id}/edit`}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Link>
                                  </Button>
                                )}
                                {row.locked ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setDeletingPayment(row.payment!)
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                          {t('noTransactions')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {paginatedTransactions.map((row) => (
                  <article
                    key={row.id}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-card shadow-sm',
                      row.payment && 'cursor-pointer',
                    )}
                    onClick={() => {
                      if (row.payment) router.push(`/expenses/payments/${row.payment.id}/edit`)
                    }}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Badge variant={row.source === 'payroll' ? 'secondary' : 'outline'}>
                          {row.source === 'payroll' ? t('payroll') : t(row.source)}
                        </Badge>
                        <h3 className="mt-2 break-words text-sm font-semibold">{row.name}</h3>
                      </div>
                      {row.payment && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={row.locked}
                            asChild={!row.locked}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.locked ? (
                              <Pencil className="size-4" />
                            ) : (
                              <Link href={`/expenses/payments/${row.payment.id}/edit`}>
                                <Pencil className="size-4" />
                              </Link>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={row.locked}
                            onClick={(event) => {
                              event.stopPropagation()
                              setDeletingPayment(row.payment!)
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <dl className="divide-y border-t px-4">
                      {[
                        [t('category'), row.category],
                        [t('period'), row.period],
                        [t('amount'), formatCurrency(row.amount)],
                        [t('paymentMethod'), paymentMethodLabel(row.paymentMethod)],
                        [t('createdAt'), formatDate(row.createdAt, locale)],
                        [t('updatedAt'), formatDate(row.updatedAt, locale)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 py-2.5"
                        >
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="break-words text-right text-sm">{value}</dd>
                        </div>
                      ))}
                      <div className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] items-center gap-3 py-2.5">
                        <dt className="text-xs text-muted-foreground">{commonT('status')}</dt>
                        <dd
                          className="flex justify-end"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {row.payment && !row.locked ? (
                            <Select
                              value={row.status}
                              onValueChange={(status) => {
                                if (status === row.status) return
                                setStatusChange({
                                  payment: row.payment!,
                                  status: status as ExpensePaymentStatus,
                                })
                              }}
                            >
                              <SelectTrigger className="h-8 w-auto min-w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {t(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={statusVariant(row.status)}>{t(row.status)}</Badge>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
                {filteredTransactions.length === 0 && (
                  <div className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">
                    {t('noTransactions')}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-row items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-6">
                  <div className="hidden items-center gap-2 lg:flex">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {commonT('rowsPerPage')}
                    </span>
                    <Select
                      value={`${transactionPageSize}`}
                      onValueChange={(value) => {
                        setTransactionPageSize(Number(value))
                        setTransactionPageIndex(0)
                      }}
                    >
                      <SelectTrigger className="w-20" size="sm">
                        <SelectValue placeholder={transactionPageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="whitespace-nowrap text-sm text-muted-foreground">
                    {commonT('showingItems', {
                      shown: Math.min(transactionEnd, filteredTransactions.length),
                      total: filteredTransactions.length,
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="whitespace-nowrap text-sm font-medium">
                    {commonT('page')} {safeTransactionPageIndex + 1} / {transactionPageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => setTransactionPageIndex(0)}
                      disabled={!canPreviousTransactionPage}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setTransactionPageIndex((index) => Math.max(0, index - 1))}
                      disabled={!canPreviousTransactionPage}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setTransactionPageIndex((index) =>
                          Math.min(transactionPageCount - 1, index + 1),
                        )
                      }
                      disabled={!canNextTransactionPage}
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => setTransactionPageIndex(transactionPageCount - 1)}
                      disabled={!canNextTransactionPage}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurrings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('recurrings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={recurringStatusFilter} onValueChange={setRecurringStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allStatus')}</SelectItem>
                    <SelectItem value="active">{commonT('active')}</SelectItem>
                    <SelectItem value="inactive">{commonT('inactive')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recurringCycleFilter} onValueChange={setRecurringCycleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allCycles')}</SelectItem>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('name')}</TableHead>
                      <TableHead>{t('category')}</TableHead>
                      <TableHead>{t('amount')}</TableHead>
                      <TableHead>{t('billingCycle')}</TableHead>
                      <TableHead>{t('startingDate')}</TableHead>
                      <TableHead>{t('dueDate')}</TableHead>
                      <TableHead>{t('isReimbursable')}</TableHead>
                      <TableHead>{commonT('status')}</TableHead>
                      <TableHead className="text-right">{commonT('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((expense) => {
                      const currentKey = getCurrentMonthKey()
                      const generationDate = expense.startDate
                        ? getExpenseGenerationDate(expense, currentKey)
                        : null
                      const dueDate = expense.startDate
                        ? getExpenseDueDate(expense, currentKey)
                        : null
                      const employee = expense.reimbursableEmployeeId
                        ? employeeById.get(expense.reimbursableEmployeeId)
                        : null

                      return (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.name}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell>{formatCurrency(toAmount(expense.amount))}</TableCell>
                          <TableCell>{t(expense.billingCycle || 'monthly')}</TableCell>
                          <TableCell>{formatDate(generationDate, locale)}</TableCell>
                          <TableCell>{formatDate(dueDate, locale)}</TableCell>
                          <TableCell>
                            {expense.isReimbursable ? employee?.fullName || '-' : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={expense.isActive ? 'success' : 'secondary'}>
                              {expense.isActive ? commonT('active') : commonT('inactive')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="outline" size="icon" asChild>
                                <Link href={`/expenses/${expense.id}/edit`}>
                                  <Pencil className="h-3 w-3" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingExpense(expense)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          {t('noRecurrings')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {paginatedExpenses.map((expense) => {
                  const currentKey = getCurrentMonthKey()
                  const generationDate = expense.startDate
                    ? getExpenseGenerationDate(expense, currentKey)
                    : null
                  const dueDate = expense.startDate ? getExpenseDueDate(expense, currentKey) : null
                  const employee = expense.reimbursableEmployeeId
                    ? employeeById.get(expense.reimbursableEmployeeId)
                    : null

                  return (
                    <article
                      key={expense.id}
                      className="overflow-hidden rounded-xl border bg-card shadow-sm"
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{t('name')}</p>
                          <h3 className="mt-1 break-words text-sm font-semibold">{expense.name}</h3>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/expenses/${expense.id}/edit`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingExpense(expense)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <dl className="divide-y border-t px-4">
                        {[
                          [t('category'), expense.category],
                          [t('amount'), formatCurrency(toAmount(expense.amount))],
                          [t('billingCycle'), t(expense.billingCycle || 'monthly')],
                          [t('startingDate'), formatDate(generationDate, locale)],
                          [t('dueDate'), formatDate(dueDate, locale)],
                          [
                            t('isReimbursable'),
                            expense.isReimbursable ? employee?.fullName || '-' : '-',
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3 py-2.5"
                          >
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="break-words text-right text-sm">{value}</dd>
                          </div>
                        ))}
                        <div className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] items-center gap-3 py-2.5">
                          <dt className="text-xs text-muted-foreground">{commonT('status')}</dt>
                          <dd className="flex justify-end">
                            <Badge variant={expense.isActive ? 'success' : 'secondary'}>
                              {expense.isActive ? commonT('active') : commonT('inactive')}
                            </Badge>
                          </dd>
                        </div>
                      </dl>
                    </article>
                  )
                })}
                {filteredExpenses.length === 0 && (
                  <div className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">
                    {t('noRecurrings')}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-row items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-6">
                  <div className="hidden items-center gap-2 lg:flex">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {commonT('rowsPerPage')}
                    </span>
                    <Select
                      value={`${recurringPageSize}`}
                      onValueChange={(value) => {
                        setRecurringPageSize(Number(value))
                        setRecurringPageIndex(0)
                      }}
                    >
                      <SelectTrigger className="w-20" size="sm">
                        <SelectValue placeholder={recurringPageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="whitespace-nowrap text-sm text-muted-foreground">
                    {commonT('showingItems', {
                      shown: Math.min(recurringEnd, filteredExpenses.length),
                      total: filteredExpenses.length,
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="whitespace-nowrap text-sm font-medium">
                    {commonT('page')} {safeRecurringPageIndex + 1} / {recurringPageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => setRecurringPageIndex(0)}
                      disabled={!canPreviousRecurringPage}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setRecurringPageIndex((index) => Math.max(0, index - 1))}
                      disabled={!canPreviousRecurringPage}
                    >
                      <span className="sr-only">Go to previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setRecurringPageIndex((index) =>
                          Math.min(recurringPageCount - 1, index + 1),
                        )
                      }
                      disabled={!canNextRecurringPage}
                    >
                      <span className="sr-only">Go to next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => setRecurringPageIndex(recurringPageCount - 1)}
                      disabled={!canNextRecurringPage}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(statusChange)}
        onOpenChange={(open) => !open && setStatusChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChange ? t('confirmStatusTitle', { status: t(statusChange.status) }) : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChange
                ? t('confirmStatusDescription', {
                    name: statusChange.payment.name,
                    status: t(statusChange.status),
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonT('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                submitStatusChange()
              }}
              className={
                statusChange?.status === 'paid' || statusChange?.status === 'cancelled'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : undefined
              }
            >
              {commonT('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingExpense)}
        onOpenChange={(open) => !open && setDeletingExpense(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteExpense')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deletingExpense?.name || t('thisExpense') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonT('cancel')}</AlertDialogCancel>
            <form
              action={async (formData) => {
                try {
                  await deleteExpenseAction(formData)
                  notify.success(t('deleted'))
                  setDeletingExpense(null)
                } catch (error) {
                  notify.error(error, t('deleteFailed'))
                }
              }}
            >
              <input type="hidden" name="id" value={deletingExpense?.id || ''} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {commonT('delete')}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingPayment)}
        onOpenChange={(open) => !open && setDeletingPayment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deletePayment')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm', { name: deletingPayment?.name || t('thisExpense') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonT('cancel')}</AlertDialogCancel>
            <form
              action={async (formData) => {
                try {
                  await deleteExpensePaymentAction(formData)
                  notify.success(t('deleted'))
                  setDeletingPayment(null)
                } catch (error) {
                  notify.error(error, t('deleteFailed'))
                }
              }}
            >
              <input type="hidden" name="id" value={deletingPayment?.id || ''} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {commonT('delete')}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
