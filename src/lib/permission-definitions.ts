export const permissionResources = [
  'employees',
  'leaves',
  'payroll',
  'inventory',
  'expenses',
  'applicants',
  'announcements',
  'settings',
] as const

export const permissionActions = ['view', 'create', 'edit', 'delete', 'approve'] as const
export const permissionScopes = ['none', 'own', 'managed', 'all'] as const

export type PermissionResource = (typeof permissionResources)[number]
export type PermissionAction = (typeof permissionActions)[number]
export type PermissionScope = (typeof permissionScopes)[number]

export function isPermissionResource(value: string): value is PermissionResource {
  return permissionResources.includes(value as PermissionResource)
}

export function isPermissionAction(value: string): value is PermissionAction {
  return permissionActions.includes(value as PermissionAction)
}

export function isPermissionScope(value: string): value is PermissionScope {
  return permissionScopes.includes(value as PermissionScope)
}
