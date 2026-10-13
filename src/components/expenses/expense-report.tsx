'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Download, X } from 'lucide-react'
import { Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/date-range-picker'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { DataTable } from '@/components/data-table'
import {
  calculateExpenseReportMonth,
  getRecentClosedMonthKeys,
  parseMonthKey,
  toAmount,
  type ExpensePaymentRecord,
  type PayrollExpenseRecord,
} from '@/lib/expenses'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

interface ExpenseReportProps {
  payments: ExpensePaymentRecord[]
  payroll: PayrollExpenseRecord[]
}

type ReportRow = {
  id: string
  source: 'oneTime' | 'recurring' | 'payroll'
  type: string
  name: string
  category: string
  amount: number
  details: string
  transactionDate: string
  createdAt: string
  updatedAt: string
}

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

export function ExpenseReport({ payments, payroll }: ExpenseReportProps) {
  const locale = useLocale()
  const t = useTranslations('expenses')
  const commonT = useTranslations('common')
  const enumT = useTranslations('enums')
  const monthKeys = React.useMemo(() => getRecentClosedMonthKeys(5), [])
  const [selectedMonth, setSelectedMonth] = React.useState(monthKeys[0])
  const [exportOpen, setExportOpen] = React.useState(false)
  const [exportStartDate, setExportStartDate] = React.useState('')
  const [exportEndDate, setExportEndDate] = React.useState('')
  const [exportSources, setExportSources] = React.useState<string[]>([])
  const [exportCategories, setExportCategories] = React.useState<string[]>([])
  const selectedView = React.useMemo(
    () => calculateExpenseReportMonth(selectedMonth, payments, payroll, locale),
    [locale, payments, payroll, selectedMonth],
  )
  const trendData = React.useMemo(
    () =>
      [...monthKeys].reverse().map((key) => {
        const view = calculateExpenseReportMonth(key, payments, payroll, locale)
        return {
          month: parseMonthKey(key, locale).shortLabel,
          total: view.totals.total,
        }
      }),
    [locale, monthKeys, payments, payroll],
  )

  const payrollTypeLabel = React.useCallback(
    (kind: PayrollExpenseRecord['kind']) => {
      if (!kind || kind === 'salary') return t('salary')
      return enumT(`paymentCategory.${kind}` as any)
    },
    [enumT, t],
  )

  const pieData = React.useMemo(() => {
    const values = [
      { name: t('payroll'), value: selectedView.totals.payroll, fill: 'var(--chart-1)' },
      { name: t('single'), value: selectedView.totals.oneTime, fill: 'var(--chart-2)' },
      { name: t('recurring'), value: selectedView.totals.recurring, fill: 'var(--chart-3)' },
    ].filter((item) => item.value > 0)

    return values.length > 0
      ? values
      : [{ name: t('totalExpenses'), value: 0, fill: 'var(--chart-4)' }]
  }, [selectedView, t])

  const trendConfig = {
    total: {
      label: t('totalExpenses'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const pieConfig = {
    value: {
      label: t('amount'),
    },
  } satisfies ChartConfig

  const rows = React.useMemo<ReportRow[]>(() => {
    const paymentRows = [...selectedView.oneTimeExpenses, ...selectedView.recurringExpenses].map(
      (payment) => ({
        id: `expense-${payment.id}`,
        source: payment.type,
        type: payment.type === 'oneTime' ? t('oneTime') : t('recurring'),
        name: payment.name,
        category: payment.category,
        amount: toAmount(payment.amount),
        details: payment.vendor || '-',
        transactionDate: payment.generationDate,
        createdAt: payment.createdAt || '',
        updatedAt: payment.updatedAt || payment.createdAt || '',
      }),
    )

    const payrollRows = selectedView.payrollExpenses.map((payment) => ({
      id: payment.id,
      source: 'payroll' as const,
      type: payrollTypeLabel(payment.kind),
      name: payment.employee?.fullName || t('payroll'),
      category: t('payroll'),
      amount: toAmount(payment.totalAmount),
      details: payrollTypeLabel(payment.kind),
      transactionDate: `${payment.year}-${String(payment.month).padStart(2, '0')}-01`,
      createdAt: `${payment.year}-${String(payment.month).padStart(2, '0')}-01`,
      updatedAt: '',
    }))

    return [...paymentRows, ...payrollRows]
  }, [payrollTypeLabel, selectedView, t])

  const exportSourceOptions = React.useMemo(
    () => [
      { value: 'payroll', label: t('payroll') },
      { value: 'oneTime', label: t('single') },
      { value: 'recurring', label: t('recurring') },
    ],
    [t],
  )
  const exportCategoryOptions = React.useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.category)))
        .sort()
        .map((category) => ({ value: category, label: category })),
    [rows],
  )
  const exportRows = React.useMemo(
    () =>
      rows.filter((row) => {
        const rowDate = row.transactionDate.slice(0, 10)
        if (exportStartDate && (!rowDate || rowDate < exportStartDate)) return false
        if (exportEndDate && (!rowDate || rowDate > exportEndDate)) return false
        if (exportSources.length > 0 && !exportSources.includes(row.source)) return false
        if (exportCategories.length > 0 && !exportCategories.includes(row.category)) return false
        return true
      }),
    [exportCategories, exportEndDate, exportSources, exportStartDate, rows],
  )

  const columns = [
    {
      key: 'source' as keyof ReportRow,
      header: t('expenseType'),
      render: (value: unknown, item: ReportRow) => (
        <Badge variant={String(value) === 'payroll' ? 'secondary' : 'outline'}>{item.type}</Badge>
      ),
    },
    { key: 'name' as keyof ReportRow, header: t('name') },
    { key: 'category' as keyof ReportRow, header: t('category') },
    {
      key: 'amount' as keyof ReportRow,
      header: t('amount'),
      render: (value: unknown) => formatCurrency(Number(value || 0)),
    },
    { key: 'details' as keyof ReportRow, header: t('details') },
  ]

  function csvCell(value: unknown) {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }

  function exportSelectedMonth() {
    const rowsForExport = exportRows.map((row) => ({
      Month: selectedView.month.label,
      Source: row.type,
      Name: row.name,
      Category: row.category,
      Amount: row.amount,
      Details: row.details,
      Date: formatDate(row.transactionDate, locale),
      Created: formatDate(row.createdAt, locale),
      Updated: formatDate(row.updatedAt, locale),
    }))
    const headers = [
      'Month',
      'Source',
      'Name',
      'Category',
      'Amount',
      'Details',
      'Date',
      'Created',
      'Updated',
    ]
    const csv = [
      headers.map(csvCell).join(','),
      ...rowsForExport.map((row) =>
        headers.map((header) => csvCell(row[header as keyof typeof row])).join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expense-transactions-${selectedView.month.key}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('expenseReport')}</h1>
          <p className="text-sm text-muted-foreground">{selectedView.month.label}</p>
        </div>
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              <Download className="h-4 w-4" />
              {t('exportXlsx')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('exportExpenses')}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DateRangePicker
                label={t('dateRange')}
                startValue={exportStartDate}
                endValue={exportEndDate}
                onStartValueChange={setExportStartDate}
                onEndValueChange={setExportEndDate}
              />
              <MultiSelectFilter
                label={t('paymentSource')}
                placeholder={t('selectSources')}
                values={exportSources}
                options={exportSourceOptions}
                onChange={setExportSources}
              />
              <MultiSelectFilter
                label={t('category')}
                placeholder={t('selectCategories')}
                values={exportCategories}
                options={exportCategoryOptions}
                onChange={setExportCategories}
              />
              <div className="flex items-end text-sm text-muted-foreground">
                {t('exportRows', { count: exportRows.length })}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExportStartDate('')
                  setExportEndDate('')
                  setExportSources([])
                  setExportCategories([])
                }}
              >
                {t('resetFilters')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {commonT('cancel')}
                </Button>
              </DialogClose>
              <Button type="button" onClick={exportSelectedMonth}>
                <Download className="h-4 w-4" />
                {t('exportXlsx')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ButtonGroup className="overflow-x-auto">
        {monthKeys.map((key, index) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={selectedMonth === key ? 'default' : 'outline'}
            onClick={() => setSelectedMonth(key)}
          >
            {index === 0 ? t('lastMonth') : parseMonthKey(key, locale).label}
          </Button>
        ))}
      </ButtonGroup>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t('totalExpenses')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(selectedView.totals.total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t('payroll')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(selectedView.totals.payroll)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t('oneTime')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(selectedView.totals.oneTime)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t('recurring')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(selectedView.totals.recurring)}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('expenseTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[280px] w-full">
              <LineChart data={trendData} margin={{ left: 12, right: 12 }}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₺${value}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('expenseBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const amount = Number(value || 0)
                        const percentage =
                          selectedView.totals.total > 0
                            ? Math.round((amount / selectedView.totals.total) * 100)
                            : 0
                        return `${name}: ${formatCurrency(amount)} (${percentage}%)`
                      }}
                    />
                  }
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('expenseRecords')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={rows} columns={columns} />
        </CardContent>
      </Card>
    </div>
  )
}
