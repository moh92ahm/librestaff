'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { payrollSettingsTable, usersTable } from '@/db/schema'
import { useTranslations } from 'next-intl'

type PayrollSetting = InferSelectModel<typeof payrollSettingsTable> & {
  employee?: User | null
}
type User = InferSelectModel<typeof usersTable>
import { PayrollSettingsTable } from '@/components/payroll/settings/table'

interface PayrollSettingsListProps {
  data: PayrollSetting[]
}

export function PayrollSettingsList({ data }: PayrollSettingsListProps) {
  const t = useTranslations('payroll')
  const common = useTranslations('common')
  const [query, setQuery] = React.useState('')

  // Filter by status (active/inactive)
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('active')

  // Filter by employee
  const [selectedEmployee, setSelectedEmployee] = React.useState<string>('all')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.filter((item) => {
      const employee =
        typeof item.employee === 'object' && item.employee && 'fullName' in item.employee
          ? ((item.employee as User).fullName || '').toLowerCase()
          : String(item.employee || '').toLowerCase()

      const description = (item.description || '').toLowerCase()
      const paymentType = String(item.paymentType || '').toLowerCase()

      // Apply status filter
      if (statusFilter === 'active' && !item.isActive) return false
      if (statusFilter === 'inactive' && item.isActive) return false

      // Apply employee filter
      if (selectedEmployee !== 'all') {
        const employeeId =
          typeof item.employee === 'object' && item.employee && 'id' in item.employee
            ? String(item.employee.id)
            : String(item.employee)
        if (employeeId !== selectedEmployee) return false
      }

      if (!q) return true

      return employee.includes(q) || description.includes(q) || paymentType.includes(q)
    })
  }, [data, query, statusFilter, selectedEmployee])

  // Get unique employees for filter
  const employees = React.useMemo(() => {
    const uniqueEmployees = new Map<string, string>()
    data.forEach((item) => {
      if (typeof item.employee === 'object' && item.employee && 'id' in item.employee) {
        const emp = item.employee as User
        uniqueEmployees.set(String(emp.id), emp.fullName || common('unknown'))
      }
    })
    return Array.from(uniqueEmployees.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, common])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex gap-4 sm:items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('settings')}</h1>
        </div>
        <Link href="/payroll/settings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('newSetting')}
          </Button>
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: All Filters (Employee + Status) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          {/* Status Filter */}
          <ButtonGroup className="w-full sm:w-auto overflow-x-auto">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
              className="flex-1"
            >
              {common('all')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('active')}
              className="flex-1"
            >
              {common('active')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('inactive')}
              className="flex-1"
            >
              {common('inactive')}
            </Button>
          </ButtonGroup>

          {/* Employee Filter */}
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('allEmployees')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allEmployees')}</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right: Search Input */}
        <div className="flex lg:ml-auto">
          <Input
            placeholder={t('searchSettings')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full lg:w-80"
          />
        </div>
      </div>

      <PayrollSettingsTable data={filtered} />
    </div>
  )
}
