'use client'

import * as React from 'react'
import { Pencil, Trash2, Users } from 'lucide-react'
import { notify } from '@/lib/notify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/data-table'
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
import type { Department } from '@/components/departments/department-list'
import { useTranslations } from 'next-intl'

interface DepartmentTableProps {
  data: Department[]
  rootDepartmentName: string
  onEdit: (department: Department) => void
  onDeleted: () => void
}

export function DepartmentTable({
  data,
  rootDepartmentName,
  onEdit,
  onDeleted,
}: DepartmentTableProps) {
  const t = useTranslations('departments')
  const commonT = useTranslations('common')
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [departmentToDelete, setDepartmentToDelete] = React.useState<Department | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDeleteClick = (department: Department) => {
    setDepartmentToDelete(department)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!departmentToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/departments/${departmentToDelete.id}`, {
        method: 'DELETE',
      })

      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error || t('deleteFailed'))
      }

      notify.success(t('departmentDeleted'))
      setDeleteDialogOpen(false)
      setDepartmentToDelete(null)
      onDeleted()
    } catch (error) {
      notify.error(error, t('deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name' as keyof Department,
      header: commonT('name'),
      render: (value: unknown, department: Department) => (
        <span
          className="block font-medium"
          style={{ marginLeft: department.parentDepartmentId ? 10 : 0 }}
        >
          {String(value || '-')}
        </span>
      ),
    },
    {
      key: 'description' as keyof Department,
      header: t('description'),
      render: (value: unknown) =>
        value ? (
          <span className="text-muted-foreground">{String(value)}</span>
        ) : (
          <span className="italic text-muted-foreground">{t('noDescription')}</span>
        ),
    },
    {
      key: 'isActive' as keyof Department,
      header: commonT('status'),
      render: (value: unknown) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? commonT('active') : commonT('inactive')}
        </Badge>
      ),
    },
    {
      key: 'userCount' as keyof Department,
      header: t('users'),
      render: (value: unknown) => (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{Number(value || 0)}</span>
        </div>
      ),
    },
    {
      key: 'managers' as keyof Department,
      header: t('managers'),
      render: (_value: unknown, department: Department) => {
        if (department.managers.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }

        return (
          <div className="flex flex-wrap gap-1">
            {department.inheritedManagers.map((manager) => (
              <Badge key={manager.id} variant="outline">
                {manager.fullName}
              </Badge>
            ))}
            {department.directManagers.map((manager) => (
              <Badge key={manager.id} variant="outline">
                {manager.fullName}
              </Badge>
            ))}
          </div>
        )
      },
    },
  ]

  const actionColumn = (department: Department) => (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => onEdit(department)}>
        <Pencil className="h-4 w-4 mr-2" />
        {commonT('edit')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDeleteClick(department)}
        disabled={
          department.name === rootDepartmentName ||
          department.userCount > 0 ||
          department.childCount > 0
        }
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {commonT('delete')}
      </Button>
    </div>
  )

  return (
    <>
      <DataTable data={data} columns={columns} actionColumn={actionColumn} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDepartment')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich('deleteConfirm', {
                name: departmentToDelete?.name || '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{commonT('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? commonT('deleting') : commonT('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
