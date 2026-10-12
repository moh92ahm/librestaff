'use client'

import * as React from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Filter } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable> & {
  role?: { id: string; name: string } | null
  department?: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    description: string | null
  } | null
}
import { UserTable } from '@/components/user/table'
import { UserInviteDialog } from '@/components/user/user-invite-dialog'
import { useTranslations } from 'next-intl'

interface UserListProps {
  data: User[]
  canInvite?: boolean
  canCreate?: boolean
  canEdit?: boolean
  roles?: Array<{
    value: string
    label: string
    name: string
  }>
}

export function UserList({
  data,
  canInvite = false,
  canCreate = canInvite,
  canEdit = true,
  roles = [],
}: UserListProps) {
  const t = useTranslations('users')
  const commonT = useTranslations('common')
  const employmentT = useTranslations('labels.employmentTypes')
  const roleT = useTranslations('users.roles')
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all')
  const [employmentTypeFilter, setEmploymentTypeFilter] = React.useState<string[]>([])
  const [employmentFilterOpen, setEmploymentFilterOpen] = React.useState(false)

  // Employment type options
  const employmentTypes = [
    { value: 'citizen', label: employmentT('citizen') },
    { value: 'workPermit', label: employmentT('workPermit') },
    { value: 'other', label: employmentT('other') },
  ]
  const localizedRoles = React.useMemo(
    () =>
      roles.map((role) => ({
        ...role,
        label:
          role.name && role.name in roleT.raw('labels') ? roleT(`labels.${role.name}`) : role.label,
      })),
    [roleT, roles],
  )

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Helper functions for employment type filter
  const handleEmploymentTypeToggle = (value: string) => {
    setEmploymentTypeFilter((prev) =>
      prev.includes(value) ? prev.filter((type) => type !== value) : [...prev, value],
    )
  }

  const clearEmploymentTypeFilter = () => {
    setEmploymentTypeFilter([])
  }

  const getEmploymentTypeLabel = (value: string) => {
    return employmentTypes.find((type) => type.value === value)?.label || value
  }

  const filtered = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return data.filter((s) => {
      // Status filter
      if (statusFilter === 'active' && !s.isActive) return false
      if (statusFilter === 'inactive' && s.isActive) return false

      // Employment type filter
      if (employmentTypeFilter.length > 0) {
        const staffEmploymentType = s.employmentType || 'other'
        if (!employmentTypeFilter.includes(staffEmploymentType)) return false
      }

      // Search filter
      const name = s.fullName?.toLowerCase() || ''
      const dept = s.department?.name?.toLowerCase() || ''
      const role = s.role?.name?.toLowerCase() || ''
      const personType = String(s.personType || '').toLowerCase()
      const email = (s.email || '').toLowerCase()
      if (!q) return true
      return (
        name.includes(q) ||
        dept.includes(q) ||
        role.includes(q) ||
        personType.includes(q) ||
        email.includes(q)
      )
    })
  }, [data, debounced, statusFilter, employmentTypeFilter])

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <div className="text-sm text-muted-foreground">
              {commonT('totalShown', { total: data.length, shown: filtered.length })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {canInvite && localizedRoles.length > 0 && <UserInviteDialog roles={localizedRoles} />}
            {canCreate && (
              <Link href="/team-members/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addTeamMember')}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filters and Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          {/* Status Filter Buttons */}
          <ButtonGroup className="w-full sm:w-auto">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="flex-1 sm:flex-none"
            >
              {commonT('all')}
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('active')}
              className="flex-1 sm:flex-none"
            >
              {commonT('active')}
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('inactive')}
              className="flex-1 sm:flex-none"
            >
              {commonT('inactive')}
            </Button>
          </ButtonGroup>

          {/* Search and Filter Group */}
          <div className="flex gap-2">
            {/* Search Input */}
            <Input
              placeholder={t('searchUsers')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex"
            />

            {/* Employment Type Filter */}
            <Popover open={employmentFilterOpen} onOpenChange={setEmploymentFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={employmentTypeFilter.length > 0 ? 'border-primary' : ''}
                >
                  <Filter className="h-4 w-4" />
                  {employmentTypeFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {employmentTypeFilter.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{t('employmentType')}</h4>
                    {employmentTypeFilter.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearEmploymentTypeFilter}
                        className="h-auto p-1"
                      >
                        {commonT('clear')}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {employmentTypes.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`employment-${type.value}`}
                          checked={employmentTypeFilter.includes(type.value)}
                          onCheckedChange={() => handleEmploymentTypeToggle(type.value)}
                        />
                        <label
                          htmlFor={`employment-${type.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {type.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {employmentTypeFilter.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{t('employmentType')}:</span>
          {employmentTypeFilter.map((type) => (
            <Badge key={type} variant="secondary" className="flex items-center gap-1">
              {getEmploymentTypeLabel(type)}
              <Button
                variant="ghost"
                size="sm"
                className="p-0 w-4 h-4"
                onClick={() => handleEmploymentTypeToggle(type)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <UserTable data={filtered} canEdit={canEdit} />
    </div>
  )
}
