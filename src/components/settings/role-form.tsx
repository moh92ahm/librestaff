'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronsUpDown, Plus, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  getPermissionActionOptionsForResource,
  getPermissionActionsForResource,
  type PermissionBuilderRow,
} from '@/lib/role-permissions'
import {
  permissionResources,
  permissionScopes,
  type PermissionAction,
} from '@/lib/permission-definitions'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

type RoleFormValue = {
  id?: string
  name: string
  displayName: string
  description: string
  isActive: boolean
  permissions: PermissionBuilderRow[]
}

type RoleFormProps = {
  mode: 'create' | 'edit'
  role?: RoleFormValue
}

const emptyRole: RoleFormValue = {
  name: '',
  displayName: '',
  description: '',
  isActive: true,
  permissions: [],
}

function sameActions(a: string[], b: string[]) {
  return a.length === b.length && a.every((action, index) => action === b[index])
}

function samePermissionRow(a: PermissionBuilderRow, b: PermissionBuilderRow) {
  return a.resource === b.resource && a.scope === b.scope && sameActions(a.actions, b.actions)
}

function PermissionActionsSelect({
  resource,
  value,
  onChange,
}: {
  resource: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const t = useTranslations('settings.rolesPage')
  const [open, setOpen] = React.useState(false)
  const options = React.useMemo(
    () =>
      getPermissionActionOptionsForResource(resource).map((option) => ({
        value: option.value,
        label: t(`permissionActions.${option.value}`),
      })),
    [resource, t],
  )
  const optionByValue = React.useMemo(
    () => new Map<string, string>(options.map((option) => [option.value, option.label])),
    [options],
  )

  function handleSelect(action: string) {
    const nextActions = value.includes(action)
      ? value.filter((currentAction) => currentAction !== action)
      : [...value, action]
    onChange(nextActions)
  }

  function handleRemove(action: string, event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onChange(value.filter((currentAction) => currentAction !== action))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-expanded={open}
          className="w-full justify-between"
          role="combobox"
          variant="outline"
        >
          <div className="flex min-w-0 flex-wrap gap-1">
            {value.length > 0 ? (
              value.map((action) => (
                <Badge className="mr-1" key={action} variant="secondary">
                  {optionByValue.get(action) || action}
                  <span
                    className="ml-1 cursor-pointer rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={(event) => handleRemove(action, event)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{t('selectActions')}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={t('searchActions')} />
          <CommandList>
            <CommandEmpty>{t('noActionsFound')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                  value={option.value}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value.includes(option.value) ? 'opacity-100' : 'opacity-0',
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
  )
}

export function RoleForm({ mode, role }: RoleFormProps) {
  const router = useRouter()
  const t = useTranslations('settings.rolesPage')
  const commonT = useTranslations('common')
  const [formState, setFormState] = React.useState<RoleFormValue>(role || emptyRole)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isEdit = mode === 'edit'

  const updatePermission = (index: number, row: PermissionBuilderRow) => {
    setFormState((current) => {
      let changed = false
      const permissions = current.permissions.map((permission, rowIndex) => {
        if (rowIndex !== index) return permission
        if (samePermissionRow(permission, row)) return permission
        changed = true
        return row
      })

      return changed ? { ...current, permissions } : current
    })
  }

  const updatePermissionResource = (index: number, resource: PermissionBuilderRow['resource']) => {
    const allowedActions = new Set(getPermissionActionsForResource(resource))
    setFormState((current) => {
      let changed = false
      const permissions = current.permissions.map((permission, rowIndex) => {
        if (rowIndex !== index) return permission
        const next = {
          ...permission,
          resource,
          actions: permission.actions.filter((action) =>
            allowedActions.has(action as PermissionAction),
          ),
        }
        if (samePermissionRow(permission, next)) return permission
        changed = true
        return next
      })

      return changed ? { ...current, permissions } : current
    })
  }

  const addPermission = () => {
    setFormState((current) => ({
      ...current,
      permissions: [
        ...current.permissions,
        {
          resource: 'employees',
          actions: ['view'],
          scope: 'managed',
        },
      ],
    }))
  }

  const removePermission = (index: number) => {
    setFormState((current) => ({
      ...current,
      permissions: current.permissions.filter((_, rowIndex) => rowIndex !== index),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(isEdit ? `/api/roles/${formState.id}` : '/api/roles', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name.trim(),
          displayName: formState.displayName.trim(),
          description: formState.description.trim() || null,
          isActive: formState.isActive,
          permissions: formState.permissions.filter((row) => row.actions.length > 0),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('saveFailed'))
      }

      notify.success(isEdit ? t('roleUpdated') : t('roleCreated'))
      router.push('/settings/roles')
      router.refresh()
    } catch (error) {
      notify.error(error, t('saveFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/roles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {commonT('back')}
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{isEdit ? t('editRole') : t('createRole')}</h1>
          <p className="text-sm text-muted-foreground">{t('formDescription')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-md border">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold">{t('roleDetails')}</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">{commonT('name')}</Label>
              <Input
                id="role-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="it_manager"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-display-name">{t('displayName')}</Label>
              <Input
                id="role-display-name"
                value={formState.displayName}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="IT Manager"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="role-description">{t('roleDescription')}</Label>
              <Textarea
                id="role-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="role-active">{commonT('active')}</Label>
                <p className="text-sm text-muted-foreground">{t('inactiveRoleHelp')}</p>
              </div>
              <Switch
                id="role-active"
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          </div>
        </section>

        <section className="rounded-md border">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{t('permissions')}</h2>
              <p className="text-sm text-muted-foreground">{t('permissionsDescription')}</p>
            </div>
            <Button type="button" variant="outline" onClick={addPermission}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addPermission')}
            </Button>
          </div>

          <div className="space-y-3 p-5">
            {formState.permissions.map((permission, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-md border p-3 lg:grid-cols-[1fr_2fr_1fr_auto]"
              >
                <div className="space-y-2">
                  <Label>{t('resource')}</Label>
                  <Select
                    value={permission.resource}
                    onValueChange={(resource) =>
                      updatePermissionResource(index, resource as PermissionBuilderRow['resource'])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionResources.map((resource) => (
                        <SelectItem key={resource} value={resource}>
                          {t(`permissionResources.${resource}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('actions')}</Label>
                  <PermissionActionsSelect
                    resource={permission.resource}
                    value={permission.actions}
                    onChange={(actions) =>
                      updatePermission(index, {
                        ...permission,
                        actions: actions as PermissionBuilderRow['actions'],
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('scope')}</Label>
                  <Select
                    value={permission.scope}
                    onValueChange={(scope) =>
                      updatePermission(index, {
                        ...permission,
                        scope: scope as PermissionBuilderRow['scope'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionScopes.map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {t(`permissionScopes.${scope}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removePermission(index)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t('removePermission')}</span>
                  </Button>
                </div>
              </div>
            ))}

            {formState.permissions.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t('noCustomPermissions')}
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/roles">{commonT('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? commonT('saving') : t('saveRole')}
          </Button>
        </div>
      </form>
    </div>
  )
}
