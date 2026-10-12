import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { rolePermissionsTable, rolesTable } from '@/db/schema'
import { getManagedUserIds } from '@/lib/manager-permissions'
import { canManageUser } from '@/lib/manager-permissions'
import { requireAuth, requireAuthAPI } from '@/lib/auth-guards'
import { isAdmin, type User } from '@/lib/rbac'
import {
  isPermissionScope,
  type PermissionAction,
  type PermissionResource,
  type PermissionScope,
} from '@/lib/permission-definitions'

export type PermissionCheck = {
  allowed: boolean
  scope: PermissionScope
}

const scopeRank: Record<PermissionScope, number> = {
  none: 0,
  own: 1,
  managed: 2,
  all: 3,
}

const memberDefaults: Partial<
  Record<PermissionResource, Partial<Record<PermissionAction, PermissionScope>>>
> = {
  employees: {
    view: 'own',
    edit: 'own',
  },
  leaves: {
    view: 'own',
    create: 'own',
  },
}

export function highestScope(scopes: PermissionScope[]): PermissionScope {
  return scopes.reduce<PermissionScope>(
    (highest, scope) => (scopeRank[scope] > scopeRank[highest] ? scope : highest),
    'none',
  )
}

export function canShowScopedNavigation(scope: PermissionScope): boolean {
  return scope === 'managed' || scope === 'all'
}

export async function getPermissionScope(
  user: User | null | undefined,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<PermissionScope> {
  if (!user) return 'none'
  if (isAdmin(user)) return 'all'

  const roleName = user.role?.name
  if (roleName === 'member' || roleName === 'employee') {
    return memberDefaults[resource]?.[action] || 'none'
  }

  if (!user.role?.id) return 'none'

  const [permission] = await db
    .select({ scope: rolePermissionsTable.scope })
    .from(rolePermissionsTable)
    .innerJoin(rolesTable, eq(rolePermissionsTable.roleId, rolesTable.id))
    .where(
      and(
        eq(rolePermissionsTable.roleId, user.role.id),
        eq(rolePermissionsTable.resource, resource),
        eq(rolePermissionsTable.action, action),
        eq(rolesTable.isActive, true),
      ),
    )
    .limit(1)

  return permission && isPermissionScope(permission.scope) ? permission.scope : 'none'
}

export async function checkPermission(
  user: User | null | undefined,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<PermissionCheck> {
  const scope = await getPermissionScope(user, resource, action)
  return {
    scope,
    allowed: scope !== 'none',
  }
}

export async function hasPermission(
  user: User | null | undefined,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<boolean> {
  return (await checkPermission(user, resource, action)).allowed
}

export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction,
  redirectPath = '/me',
): Promise<User> {
  const user = await requireAuth()
  if (!(await hasPermission(user, resource, action))) {
    redirect(redirectPath)
  }
  return user
}

export async function requirePermissionAPI(
  resource: PermissionResource,
  action: PermissionAction,
): Promise<User | null> {
  const user = await requireAuthAPI()
  if (!user || !(await hasPermission(user, resource, action))) {
    return null
  }
  return user
}

export async function getScopedUserIds(
  user: User,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<string[] | null> {
  const scope = await getPermissionScope(user, resource, action)

  if (scope === 'all') return null
  if (scope === 'managed') return getManagedUserIds(user.id)
  if (scope === 'own') return [user.id]

  return []
}

export async function canAccessTargetUser(
  user: User,
  resource: PermissionResource,
  action: PermissionAction,
  targetUserId: string,
): Promise<boolean> {
  const scope = await getPermissionScope(user, resource, action)

  if (scope === 'all') return true
  if (scope === 'own') return user.id === targetUserId
  if (scope === 'managed') return canManageUser(user.id, targetUserId)

  return false
}
