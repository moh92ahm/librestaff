'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  allPayrollCategories,
  allPayrollStatuses,
  PayrollFilter,
  type PayrollCategoryFilter,
  type PayrollStatusFilter,
} from '@/components/payroll/payroll-filter'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, FileSpreadsheet } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollTable, usersTable } from '@/db/schema'
import { generatePayrollsAction } from '@/lib/actions/payroll'
import { useTranslations } from 'next-intl'

type Payroll = InferSelectModel<typeof payrollTable>
type User = InferSelectModel<typeof usersTable>

type PayrollWithEmployee = Payroll & {
  employee?: User | null
  processedBy?: User | null
}

import { PayrollTable } from '@/components/payroll/table'

interface PayrollListProps {
  data: PayrollWithEmployee[]
}

function formatMonthKey(year: number, month: string | number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthKey(key: string) {
  const [year, month] = key.split('-')
  return {
    year: Number(year),
    month: month.padStart(2, '0'),
  }
}

function isValidMonthKey(key: string | null) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return false

  const { year, month } = parseMonthKey(key)
  const monthNumber = Number(month)
  return (
    Number.isInteger(year) && year >= 2020 && year <= 2030 && monthNumber >= 1 && monthNumber <= 12
  )
}

function getCurrentMonthKey() {
  const now = new Date()
  return formatMonthKey(now.getFullYear(), now.getMonth() + 1)
}

function shiftMonthKey(key: string, offset: number) {
  const { year, month } = parseMonthKey(key)
  const date = new Date(year, Number(month) - 1 + offset, 1)
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1)
}

function parseMultiFilter<T extends string>(value: string | null, options: readonly T[]) {
  const selected = (value || '')
    .split(',')
    .filter((candidate): candidate is T => options.includes(candidate as T))

  return new Set(selected.length > 0 ? selected : options)
}

export function PayrollList({ data }: PayrollListProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentMonthKey = getCurrentMonthKey()
  const currentPeriod = parseMonthKey(currentMonthKey)
  const lastMonthKey = shiftMonthKey(currentMonthKey, -1)
  const selectedMonthKey = isValidMonthKey(searchParams.get('month'))
    ? searchParams.get('month')!
    : currentMonthKey
  const statusParam = searchParams.get('status')
  const typeParam = searchParams.get('type')
  const selectedStatuses = React.useMemo(
    () => parseMultiFilter(statusParam, allPayrollStatuses),
    [statusParam],
  )
  const selectedCategories = React.useMemo(
    () => parseMultiFilter(typeParam, allPayrollCategories),
    [typeParam],
  )
  const query = searchParams.get('q') || ''
  const selectedPeriod = React.useMemo(() => parseMonthKey(selectedMonthKey), [selectedMonthKey])

  const updateFilters = React.useCallback(
    (updates: {
      month?: string
      status?: Set<PayrollStatusFilter>
      type?: Set<PayrollCategoryFilter>
      q?: string
    }) => {
      const params = new URLSearchParams(searchParams.toString())

      const nextMonth = updates.month ?? selectedMonthKey
      const nextStatuses = updates.status ?? selectedStatuses
      const nextCategories = updates.type ?? selectedCategories
      const nextQuery = updates.q ?? query

      if (nextMonth === currentMonthKey) {
        params.delete('month')
      } else {
        params.set('month', nextMonth)
      }

      if (nextStatuses.size === allPayrollStatuses.length) {
        params.delete('status')
      } else {
        params.set(
          'status',
          allPayrollStatuses.filter((status) => nextStatuses.has(status)).join(','),
        )
      }

      if (nextCategories.size === allPayrollCategories.length) {
        params.delete('type')
      } else {
        params.set(
          'type',
          allPayrollCategories.filter((category) => nextCategories.has(category)).join(','),
        )
      }

      const trimmedQuery = nextQuery.trim()
      if (trimmedQuery) {
        params.set('q', trimmedQuery)
      } else {
        params.delete('q')
      }

      const queryString = params.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [
      currentMonthKey,
      pathname,
      query,
      router,
      searchParams,
      selectedCategories,
      selectedMonthKey,
      selectedStatuses,
    ],
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filteredItems = data.filter((item) => {
      const employee =
        typeof item.employee === 'object' && item.employee && 'fullName' in item.employee
          ? ((item.employee as User).fullName || '').toLowerCase()
          : String(item.employee || '').toLowerCase()

      const itemStatus = String((item as unknown as { status?: string }).status || '').toLowerCase()

      // Get payment type from first payroll item
      const items = item.payrollItems
      const paymentType =
        items && Array.isArray(items) && items.length > 0
          ? String((items[0] as any)?.paymentType || '').toLowerCase()
          : ''

      // Convert payment type to readable format for search
      const paymentTypeLabel =
        paymentType === 'banktransfer'
          ? 'bank transfer'
          : paymentType === 'cash'
            ? 'cash'
            : paymentType === 'cheque'
              ? 'cheque'
              : ''

      // Check if it's an additional payment
      const isAdditional = (item as any).isAdditionalPayment
      const additionalText = isAdditional ? 'additional' : ''
      const category = (isAdditional ? (item as any).additionalCategory || 'other' : 'salary') as
        | PayrollCategoryFilter
        | string
      const categoryLabel =
        category === 'salary' ? t('salary') : enumT(`paymentCategory.${category}` as any)

      // Apply period filter (month and year)
      if (item.month !== selectedPeriod.month || item.year !== selectedPeriod.year) {
        return false
      }

      if (!selectedStatuses.has(itemStatus as PayrollStatusFilter)) return false

      if (!selectedCategories.has(category as PayrollCategoryFilter)) return false

      if (!q) return true

      return (
        itemStatus.includes(q) ||
        employee.includes(q) ||
        paymentType.includes(q) ||
        paymentTypeLabel.includes(q) ||
        additionalText.includes(q) ||
        String(category).toLowerCase().includes(q) ||
        String(categoryLabel).toLowerCase().includes(q)
      )
    })

    return filteredItems.sort((a, b) => {
      const employeeA =
        typeof a.employee === 'object' && a.employee && 'fullName' in a.employee
          ? String((a.employee as User).fullName || '')
          : String(a.employeeId || '')
      const employeeB =
        typeof b.employee === 'object' && b.employee && 'fullName' in b.employee
          ? String((b.employee as User).fullName || '')
          : String(b.employeeId || '')

      const employeeCompare = employeeA.localeCompare(employeeB)
      if (employeeCompare !== 0) return employeeCompare

      const aIsAdditional = Boolean((a as any).isAdditionalPayment)
      const bIsAdditional = Boolean((b as any).isAdditionalPayment)
      if (aIsAdditional !== bIsAdditional) return aIsAdditional ? 1 : -1

      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    })
  }, [data, query, selectedStatuses, selectedCategories, selectedPeriod, t, enumT])

  const availableMonthKeys = React.useMemo(() => {
    const keys = new Set<string>([currentMonthKey, lastMonthKey])

    for (let offset = -2; offset >= -5; offset -= 1) {
      keys.add(shiftMonthKey(currentMonthKey, offset))
    }

    data.forEach((item) => {
      if (item.month && item.year) {
        keys.add(formatMonthKey(item.year, item.month))
      }
    })

    return Array.from(keys).sort((a, b) => b.localeCompare(a))
  }, [data, currentMonthKey, lastMonthKey])

  const extraMonthKeys = availableMonthKeys
    .filter((key) => key !== currentMonthKey && key !== lastMonthKey)
    .slice(0, 4)

  const formatMonthLabel = (key: string) => {
    const { month, year } = parseMonthKey(key)
    return `${enumT(`months.${month}` as any)} ${year}`
  }

  const formatCompactMonthLabel = (key: string) => {
    const { month, year } = parseMonthKey(key)
    return `${month}/${String(year).slice(-2)}`
  }

  const monthOptions = [
    { value: '01', label: enumT('months.01') },
    { value: '02', label: enumT('months.02') },
    { value: '03', label: enumT('months.03') },
    { value: '04', label: enumT('months.04') },
    { value: '05', label: enumT('months.05') },
    { value: '06', label: enumT('months.06') },
    { value: '07', label: enumT('months.07') },
    { value: '08', label: enumT('months.08') },
    { value: '09', label: enumT('months.09') },
    { value: '10', label: enumT('months.10') },
    { value: '11', label: enumT('months.11') },
    { value: '12', label: enumT('months.12') },
  ]

  const toggleStatus = (status: PayrollStatusFilter) => {
    const next = new Set(selectedStatuses)
    if (next.has(status)) {
      if (next.size === 1) return
      next.delete(status)
    } else {
      next.add(status)
    }
    updateFilters({ status: next })
  }

  const toggleCategory = (category: PayrollCategoryFilter) => {
    const next = new Set(selectedCategories)
    if (next.has(category)) {
      if (next.size === 1) return
      next.delete(category)
    } else {
      next.add(category)
    }
    updateFilters({ type: next })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('records')}</h1>
        <div className="text-sm text-muted-foreground">
          {t('items', { count: filtered.length })}
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ButtonGroup className="grid w-full grid-cols-4 overflow-hidden sm:flex sm:w-auto sm:overflow-x-auto">
          <Button
            type="button"
            size="sm"
            variant={selectedMonthKey === currentMonthKey ? 'default' : 'outline'}
            onClick={() => updateFilters({ month: currentMonthKey })}
            className="min-w-0 px-1 text-[11px] sm:flex-shrink-0 sm:px-3 sm:text-sm"
          >
            <span className="sm:hidden">{t('thisMonthShort')}</span>
            <span className="hidden sm:inline">{t('thisMonth')}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedMonthKey === lastMonthKey ? 'default' : 'outline'}
            onClick={() => updateFilters({ month: lastMonthKey })}
            className="min-w-0 px-1 text-[11px] sm:flex-shrink-0 sm:px-3 sm:text-sm"
          >
            <span className="sm:hidden">{t('lastMonthShort')}</span>
            <span className="hidden sm:inline">{t('lastMonth')}</span>
          </Button>
          {extraMonthKeys.map((monthKey, index) => (
            <Button
              key={monthKey}
              type="button"
              size="sm"
              variant={selectedMonthKey === monthKey ? 'default' : 'outline'}
              onClick={() => updateFilters({ month: monthKey })}
              className={`${index >= 2 ? 'hidden sm:inline-flex' : ''} min-w-0 px-1 text-[11px] sm:flex-shrink-0 sm:px-3 sm:text-sm`}
            >
              <span className="sm:hidden">{formatCompactMonthLabel(monthKey)}</span>
              <span className="hidden sm:inline">{formatMonthLabel(monthKey)}</span>
            </Button>
          ))}
        </ButtonGroup>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full min-w-0 px-2 text-xs sm:w-auto sm:px-4 sm:text-sm"
              >
                <FileSpreadsheet className="mr-1.5 size-4 shrink-0 sm:mr-2" />
                <span className="truncate">{t('generatePayrolls')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('generatePayrolls')}</DialogTitle>
                <DialogDescription>{t('generateDescription')}</DialogDescription>
              </DialogHeader>
              <form action={generatePayrollsAction} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="generate-month" className="text-sm font-medium">
                      {t('month')}
                    </label>
                    <Select name="month" defaultValue={currentPeriod.month}>
                      <SelectTrigger id="generate-month" className="w-full">
                        <SelectValue placeholder={t('month')} />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="generate-year" className="text-sm font-medium">
                      {t('year')}
                    </label>
                    <Input
                      id="generate-year"
                      name="year"
                      type="number"
                      min="2020"
                      max="2030"
                      defaultValue={currentPeriod.year}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      {common('cancel')}
                    </Button>
                  </DialogClose>
                  <Button type="submit">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {t('generate')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Link href="/payroll/additional/new" className="min-w-0">
            <Button className="w-full min-w-0 px-2 text-xs sm:w-auto sm:px-4 sm:text-sm">
              <Plus className="mr-1.5 size-4 shrink-0 sm:mr-2" />
              <span className="truncate">{t('newPayment')}</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start justify-between gap-3 sm:grid-cols-[auto_minmax(16rem,20rem)]">
        <PayrollFilter
          selectedStatuses={selectedStatuses}
          selectedCategories={selectedCategories}
          onToggleStatus={toggleStatus}
          onToggleCategory={toggleCategory}
          onSelectAllStatuses={() => updateFilters({ status: new Set(allPayrollStatuses) })}
          onSelectAllCategories={() => updateFilters({ type: new Set(allPayrollCategories) })}
        />
        <Input
          className="w-full"
          placeholder={t('search')}
          value={query}
          onChange={(e) => updateFilters({ q: e.target.value })}
        />
      </div>

      <PayrollTable data={filtered} />
    </div>
  )
}
