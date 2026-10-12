'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

interface Department {
  id: string
  name: string
  parentDepartmentId: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  inheritedManagers?: Array<{
    id: string
    fullName: string
  }>
  directManagerId?: string | null
}

interface DepartmentFormProps {
  department?: Department | null
  managerOptions: Array<{ value: string; label: string }>
  rootManagerOptions: Array<{ value: string; label: string }>
  parentDepartmentOptions: Array<{ value: string; label: string }>
  rootDepartmentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DepartmentForm({
  department,
  managerOptions,
  rootManagerOptions,
  parentDepartmentOptions,
  rootDepartmentName,
  open,
  onOpenChange,
  onSuccess,
}: DepartmentFormProps) {
  const t = useTranslations('departments')
  const commonT = useTranslations('common')
  const [name, setName] = useState(department?.name || '')
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(
    department?.parentDepartmentId || null,
  )
  const [description, setDescription] = useState(department?.description || '')
  const [isActive, setIsActive] = useState(department?.isActive ?? true)
  const [managerUserId, setManagerUserId] = useState<string | null>(
    department?.directManagerId || null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = !!department
  const isRootDepartment = department?.name === rootDepartmentName
  const availableManagerOptions = isRootDepartment ? rootManagerOptions : managerOptions

  useEffect(() => {
    setName(department?.name || '')
    setParentDepartmentId(department?.parentDepartmentId || null)
    setDescription(department?.description || '')
    setIsActive(department?.isActive ?? true)
    setManagerUserId(department?.directManagerId || null)
  }, [department])

  const selectableParentDepartments = parentDepartmentOptions.filter(
    (option) => option.value !== department?.id,
  )
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = isEdit ? `/api/departments/${department.id}` : '/api/departments'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parentDepartmentId,
          description: description.trim() || null,
          isActive,
          managerUserId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('saveFailed'))
      }

      notify.success(
        data.message ||
          t('departmentSaved', {
            mode: isEdit ? t('departmentUpdated') : t('departmentCreated'),
          }),
      )
      onSuccess()
      onOpenChange(false)

      // Reset form
      if (!isEdit) {
        setName('')
        setParentDepartmentId(null)
        setDescription('')
        setIsActive(true)
        setManagerUserId(null)
      }
    } catch (error) {
      notify.error(error, t('saveFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('editDepartment') : t('createDepartment')}</DialogTitle>
            <DialogDescription>
              {isEdit ? t('updateDescription') : t('createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                {commonT('name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Engineering, Marketing"
                maxLength={100}
                disabled={isRootDepartment}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('parentDepartment')}</Label>
              <Select
                value={parentDepartmentId || 'none'}
                onValueChange={(value) => setParentDepartmentId(value === 'none' ? null : value)}
                disabled={isRootDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectParentDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noParentDepartment')}</SelectItem>
                  {selectableParentDepartments.map((departmentOption) => (
                    <SelectItem key={departmentOption.value} value={departmentOption.value}>
                      {departmentOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t('parentDepartmentHelp')}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('optionalDescription')}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('manager')}</Label>
              <Select
                value={managerUserId || 'none'}
                onValueChange={(value) => setManagerUserId(value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectManager')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" textValue={t('noManager')}>
                    {t('noManager')}
                  </SelectItem>
                  {availableManagerOptions.map((manager) => (
                    <SelectItem key={manager.value} value={manager.value} textValue={manager.label}>
                      {manager.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {Boolean(department?.inheritedManagers?.length) && (
                <div className="flex flex-wrap gap-1">
                  {department?.inheritedManagers?.map((manager) => (
                    <Badge key={manager.id} variant="outline">
                      {manager.fullName} {t('inheritedManager')}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{t('managerHelp')}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">{commonT('active')}</Label>
                <p className="text-sm text-muted-foreground">{t('inactiveHelp')}</p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isRootDepartment}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {commonT('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? commonT('saving') : isEdit ? commonT('save') : commonT('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
