import { z } from 'zod'
import {
  isPermissionAction,
  isPermissionResource,
  isPermissionScope,
  permissionActions,
  permissionResources,
  permissionScopes,
  type PermissionAction,
  type PermissionResource,
  type PermissionScope,
} from '@/lib/permission-definitions'

export const permissionResourceOptions = permissionResources.map((resource) => ({
  value: resource,
  label: resourceLabel(resource),
}))

export const permissionActionOptions = permissionActions.map((action) => ({
  value: action,
  label: actionLabel(action),
}))

const permissionActionsByResource: Partial<Record<PermissionResource, PermissionAction[]>> = {
  announcements: ['create', 'edit', 'delete'],
}

export const permissionScopeOptions = permissionScopes.map((scope) => ({
  value: scope,
  label: scopeLabel(scope),
}))

export const permissionBuilderRowSchema = z.object({
  resource: z.string().refine(isPermissionResource),
  actions: z.array(z.string().refine(isPermissionAction)).min(1),
  scope: z.string().refine(isPermissionScope),
})

export const rolePayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Use only letters, numbers, underscores, and dashes'),
  displayName: z.string().trim().min(2).max(100),
  description: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  permissions: z.array(permissionBuilderRowSchema).default([]),
})

export type PermissionBuilderRow = z.infer<typeof permissionBuilderRowSchema>
export type RolePayload = z.infer<typeof rolePayloadSchema>

export type NormalizedPermission = {
  resource: PermissionResource
  action: PermissionAction
  scope: PermissionScope
}

export function getPermissionActionsForResource(
  resource: PermissionResource | string,
): PermissionAction[] {
  if (!isPermissionResource(resource)) return []
  return permissionActionsByResource[resource] || [...permissionActions]
}

export function getPermissionActionOptionsForResource(resource: PermissionResource | string) {
  return getPermissionActionsForResource(resource).map((action) => ({
    value: action,
    label: actionLabel(action),
  }))
}

export function isPermissionActionAllowedForResource(
  resource: PermissionResource | string,
  action: PermissionAction | string,
) {
  if (!isPermissionAction(action)) return false
  return getPermissionActionsForResource(resource).includes(action)
}

export function normalizePermissionRows(rows: PermissionBuilderRow[]): NormalizedPermission[] {
  const byKey = new Map<string, NormalizedPermission>()

  for (const row of rows) {
    for (const action of row.actions) {
      if (!isPermissionActionAllowedForResource(row.resource, action)) {
        continue
      }
      const permission = {
        resource: row.resource as PermissionResource,
        action: action as PermissionAction,
        scope: row.scope as PermissionScope,
      }
      byKey.set(`${permission.resource}:${permission.action}`, permission)
    }
  }

  return Array.from(byKey.values())
}

export function groupPermissionRows(
  rows: Array<{ resource: string; action: string; scope: string }>,
): PermissionBuilderRow[] {
  const groups = new Map<string, PermissionBuilderRow>()

  for (const row of rows) {
    if (
      !isPermissionResource(row.resource) ||
      !isPermissionAction(row.action) ||
      !isPermissionActionAllowedForResource(row.resource, row.action) ||
      !isPermissionScope(row.scope)
    ) {
      continue
    }

    const key = `${row.resource}:${row.scope}`
    const existing = groups.get(key)
    if (existing) {
      existing.actions.push(row.action)
    } else {
      groups.set(key, {
        resource: row.resource,
        actions: [row.action],
        scope: row.scope,
      })
    }
  }

  return Array.from(groups.values())
}

export function resourceLabel(resource: PermissionResource | string) {
  const labels: Record<string, string> = {
    employees: 'Employees',
    leaves: 'Leaves',
    payroll: 'Payroll',
    inventory: 'Inventory',
    expenses: 'Expenses',
    applicants: 'Applicants',
    announcements: 'Announcements',
    settings: 'Settings',
  }

  return labels[resource] || resource
}

export function actionLabel(action: PermissionAction | string) {
  const labels: Record<string, string> = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    approve: 'Approve',
  }

  return labels[action] || action
}

export function scopeLabel(scope: PermissionScope | string) {
  const labels: Record<string, string> = {
    none: 'None',
    own: 'Own',
    managed: 'Managed',
    all: 'All',
  }

  return labels[scope] || scope
}
