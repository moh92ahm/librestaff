// Access roles only. Manager status is modeled through department manager assignments.

export type AccessRoleName = 'admin' | 'member'
export type LegacyRoleName = 'manager' | 'employee'
export type RoleName = AccessRoleName | LegacyRoleName

export interface User {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
  language?: string | null
  theme?: string | null
  role?: {
    id: string
    name: RoleName
    displayName: string
    description?: string | null
    isSystem?: boolean
    isActive?: boolean
  }
  isActive?: boolean
  isProtectedAdmin?: boolean
  departmentId?: string | null
  department?: {
    id: string
    name: string
    description?: string | null
    isActive: boolean
  } | null
  managedDepartments?: Array<{
    id?: string
    departmentId?: string
  }>
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false
  return user.role?.name === 'admin'
}

/**
 * Check if user is manager
 */
export function isManager(user: User | null | undefined): boolean {
  return Boolean(user?.managedDepartments?.length)
}

export const isDepartmentManager = isManager

/**
 * Check if user is employee
 */
export function isEmployee(user: User | null | undefined): boolean {
  if (!user) return false
  return user.role?.name === 'member' || user.role?.name === 'employee'
}

/**
 * Check if user has full administrative access
 */
export function hasFullAccess(user: User | null | undefined): boolean {
  return isAdmin(user)
}

/**
 * Check if user should be listed by default in the team directory.
 */
export function isListedAsEmployee(user: User | null | undefined): boolean {
  if (!user) return false
  return isEmployee(user)
}

/**
 * Get user's department IDs
 */
export function getUserDepartmentIds(user: User | null | undefined): string[] {
  if (!user?.departmentId) return []
  return [user.departmentId]
}

/**
 * Get user's department names
 */
export function getUserDepartmentNames(user: User | null | undefined): string[] {
  if (!user?.department?.name) return []
  return [user.department.name]
}

/**
 * Check if user can access another user's profile
 */
export function canAccessUserProfile(currentUser: User, targetUserId: string): boolean {
  // Can always access own profile
  if (currentUser.id === targetUserId) return true

  // Admin and manager can access all profiles
  return hasFullAccess(currentUser)
}

/**
 * Get redirect path based on role
 * All authenticated users land in the shared app shell.
 */
export function getRoleRedirectPath(user: User | null | undefined): string {
  if (!user) return '/login'
  return '/'
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(user: User | null | undefined): string {
  if (!user?.role) return 'No Role'
  return user.role.displayName
}

/**
 * Get user role summary
 */
export function getRoleSummary(user: User | null | undefined): string {
  if (!user) return 'Not authenticated'
  if (isAdmin(user)) return 'Administrator - Full Access'
  if (isManager(user)) return 'Department Manager - Scoped Access'
  if (isEmployee(user)) return 'Member - Standard Access'
  return 'Unknown Role'
}
