'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { DepartmentForm } from '@/components/departments/department-form'
import { DepartmentTable } from '@/components/departments/department-table'
import { useTranslations } from 'next-intl'

export interface Department {
  id: string
  name: string
  parentDepartmentId: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  userCount: number
  childCount: number
  managers: Array<{
    id: string
    fullName: string
  }>
  inheritedManagers: Array<{
    id: string
    fullName: string
  }>
  directManagers: Array<{
    id: string
    fullName: string
  }>
  directManagerId: string | null
}

interface DepartmentListProps {
  data: Department[]
  managerOptions: Array<{ value: string; label: string }>
  rootManagerOptions: Array<{ value: string; label: string }>
  parentDepartmentOptions: Array<{ value: string; label: string }>
  rootDepartmentName: string
}

export function DepartmentList({
  data,
  managerOptions,
  rootManagerOptions,
  parentDepartmentOptions,
  rootDepartmentName,
}: DepartmentListProps) {
  const t = useTranslations('departments')
  const commonT = useTranslations('common')
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingDepartment, setEditingDepartment] = React.useState<Department | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()

    return data.filter((department) => {
      if (statusFilter === 'active' && !department.isActive) return false
      if (statusFilter === 'inactive' && department.isActive) return false

      if (!q) return true

      const name = department.name.toLowerCase()
      const description = (department.description || '').toLowerCase()
      const status = department.isActive ? 'active' : 'inactive'
      const parent = data
        .find((candidate) => candidate.id === department.parentDepartmentId)
        ?.name.toLowerCase()
      const managers = department.managers
        .map((manager) => manager.fullName)
        .join(' ')
        .toLowerCase()

      return (
        name.includes(q) ||
        description.includes(q) ||
        status.includes(q) ||
        managers.includes(q) ||
        Boolean(parent?.includes(q))
      )
    })
  }, [data, query, statusFilter])

  const ordered = React.useMemo(() => {
    const filteredIds = new Set(filtered.map((department) => department.id))
    const childrenByParent = new Map<string, Department[]>()

    for (const department of filtered) {
      if (!department.parentDepartmentId || !filteredIds.has(department.parentDepartmentId)) {
        continue
      }

      const children = childrenByParent.get(department.parentDepartmentId) || []
      children.push(department)
      childrenByParent.set(department.parentDepartmentId, children)
    }

    const result: Department[] = []
    const pushed = new Set<string>()

    for (const department of filtered) {
      if (department.parentDepartmentId && filteredIds.has(department.parentDepartmentId)) {
        continue
      }

      result.push(department)
      pushed.add(department.id)

      for (const child of childrenByParent.get(department.id) || []) {
        result.push(child)
        pushed.add(child.id)
      }
    }

    for (const department of filtered) {
      if (!pushed.has(department.id)) {
        result.push(department)
      }
    }

    return result
  }, [filtered])

  const handleCreateClick = () => {
    setEditingDepartment(null)
    setFormOpen(true)
  }

  const handleEditClick = (department: Department) => {
    setEditingDepartment(department)
    setFormOpen(true)
  }

  const handleRefresh = () => {
    router.refresh()
  }

  const handleFormSuccess = () => {
    setEditingDepartment(null)
    handleRefresh()
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <div className="text-sm text-muted-foreground">
              {commonT('totalShown', { total: data.length, shown: ordered.length })}
            </div>
          </div>

          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            {t('createDepartment')}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
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

          <Input
            placeholder={t('searchDepartments')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full sm:w-80"
          />
        </div>
      </div>

      <DepartmentTable
        data={ordered}
        rootDepartmentName={rootDepartmentName}
        onEdit={handleEditClick}
        onDeleted={handleRefresh}
      />

      <DepartmentForm
        department={editingDepartment}
        managerOptions={managerOptions}
        rootManagerOptions={rootManagerOptions}
        parentDepartmentOptions={parentDepartmentOptions}
        rootDepartmentName={rootDepartmentName}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
