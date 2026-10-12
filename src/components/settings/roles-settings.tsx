'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import { type PermissionBuilderRow } from '@/lib/role-permissions'
import { useTranslations } from 'next-intl'

export type RoleSettingsItem = {
  id: string
  name: string
  displayName: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  userCount: number
  permissions: PermissionBuilderRow[]
}

type ConfirmAction =
  | {
      type: 'duplicate'
      role: RoleSettingsItem
    }
  | {
      type: 'delete'
      role: RoleSettingsItem
    }
  | null

function truncateDescription(description: string | null) {
  if (!description) return '-'
  return description.length > 40 ? `${description.slice(0, 40)}...` : description
}

function rolePayload(role: RoleSettingsItem, isActive = role.isActive) {
  return {
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    isActive,
    permissions: role.permissions,
  }
}

function useRoleDisplayName() {
  const t = useTranslations('settings.rolesPage')

  return React.useCallback(
    (role: RoleSettingsItem) => {
      if (role.isSystem && (role.name === 'admin' || role.name === 'member')) {
        return t(`systemRoleNames.${role.name}`)
      }

      return role.displayName
    },
    [t],
  )
}

export function RolesSettings({ roles }: { roles: RoleSettingsItem[] }) {
  const router = useRouter()
  const t = useTranslations('settings.rolesPage')
  const commonT = useTranslations('common')
  const getRoleDisplayName = useRoleDisplayName()
  const [query, setQuery] = React.useState('')
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const filteredRoles = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roles

    return roles.filter((role) =>
      [role.name, role.displayName, role.description || ''].some((value) =>
        value.toLowerCase().includes(q),
      ),
    )
  }, [query, roles])

  const refresh = () => router.refresh()

  const toggleActive = async (role: RoleSettingsItem) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rolePayload(role, !role.isActive)),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('roleUpdateFailed'))
      }

      notify.success(role.isActive ? t('roleDeactivated') : t('roleActivated'))
      refresh()
    } catch (error) {
      notify.error(error, t('roleUpdateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return

    setIsSubmitting(true)
    try {
      const { role, type } = confirmAction
      const response =
        type === 'duplicate'
          ? await fetch(`/api/roles/${role.id}/duplicate`, { method: 'POST' })
          : await fetch(`/api/roles/${role.id}`, { method: 'DELETE' })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || t(type === 'duplicate' ? 'duplicateFailed' : 'deleteFailed'),
        )
      }

      notify.success(type === 'duplicate' ? t('roleDuplicated') : t('roleDeleted'))
      setConfirmAction(null)
      refresh()
    } catch (error) {
      notify.error(error, t('roleActionFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href="/settings/roles/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('createRole')}
          </Link>
        </Button>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchRoles')}
        className="max-w-md"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{commonT('name')}</TableHead>
              <TableHead>{commonT('status')}</TableHead>
              <TableHead>{t('users')}</TableHead>
              <TableHead>{t('permissions')}</TableHead>
              <TableHead>{t('roleDescription')}</TableHead>
              <TableHead className="text-right">{commonT('edit')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getRoleDisplayName(role)}</span>
                    <Badge variant={role.isSystem ? 'secondary' : 'outline'}>
                      {role.isSystem ? t('systemRole') : t('customRole')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={role.isActive ? 'default' : 'secondary'}>
                    {role.isActive ? commonT('active') : commonT('inactive')}
                  </Badge>
                </TableCell>
                <TableCell>{role.userCount}</TableCell>
                <TableCell>
                  <div className="flex max-w-[420px] flex-wrap gap-1">
                    {role.isSystem && role.name === 'admin' ? (
                      <Badge>{t('fullAccess')}</Badge>
                    ) : role.permissions.length > 0 ? (
                      role.permissions.slice(0, 2).map((permission, index) => (
                        <Badge
                          key={`${permission.resource}-${permission.scope}-${index}`}
                          variant="outline"
                        >
                          {t(`permissionResources.${permission.resource}`)} ·{' '}
                          {permission.actions
                            .map((action) => t(`permissionActions.${action}`))
                            .join(', ')}{' '}
                          · {t(`permissionScopes.${permission.scope}`)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t('noCustomPermissions')}
                      </span>
                    )}
                    {role.permissions.length > 2 && (
                      <Badge variant="secondary">+{role.permissions.length - 2}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="max-w-[260px] text-muted-foreground"
                  title={role.description || undefined}
                >
                  {truncateDescription(role.description)}
                </TableCell>
                <TableCell className="text-right">
                  {role.isSystem ? (
                    <Button variant="outline" size="sm" disabled>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{commonT('edit')}</span>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/roles/${role.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">{commonT('edit')}</span>
                      </Link>
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t('moreOptions')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!role.isSystem && (
                        <DropdownMenuItem
                          disabled={isSubmitting}
                          onSelect={(event) => {
                            event.preventDefault()
                            void toggleActive(role)
                          }}
                        >
                          <Power className="h-4 w-4" />
                          {role.isActive ? t('deactivate') : t('activate')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          setConfirmAction({ type: 'duplicate', role })
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        {t('duplicate')}
                      </DropdownMenuItem>
                      {!role.isSystem && (
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={role.userCount > 0}
                          onSelect={(event) => {
                            event.preventDefault()
                            setConfirmAction({ type: 'delete', role })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {commonT('delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete' ? t('deleteRoleTitle') : t('duplicateRoleTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete'
                ? t('deleteRoleDescription', { name: getRoleDisplayName(confirmAction.role) })
                : t('duplicateRoleDescription', {
                    name: confirmAction ? getRoleDisplayName(confirmAction.role) : '',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{commonT('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? t('working') : commonT('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
