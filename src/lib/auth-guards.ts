import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import type { User } from '@/lib/rbac'
import { isAdmin, isManager, hasFullAccess, getRoleRedirectPath } from '@/lib/rbac'

// ============================================
// Authentication Guards
// ============================================

/**
 * Require user to be authenticated
 * Redirects to login if not authenticated
 * @returns The authenticated user
 */
export async function requireAuth(): Promise<User> {
  const session = await getServerSession()

  if (
    !session?.user ||
    (session.user as User).isActive !== true ||
    (session.user as User).role?.isActive === false
  ) {
    redirect('/login')
  }

  return session.user as User
}

/**
 * Require user to be authenticated (for API routes)
 * Returns null if not authenticated instead of redirecting
 */
export async function requireAuthAPI(): Promise<User | null> {
  const session = await getServerSession()

  if (
    !session?.user ||
    (session.user as User).isActive !== true ||
    (session.user as User).role?.isActive === false
  ) {
    return null
  }

  return session.user as User
}

/**
 * Get current user without requiring authentication
 * Returns null if not authenticated
 */
export async function getOptionalUser(): Promise<User | null> {
  const session = await getServerSession()
  return session?.user ? (session.user as User) : null
}

// ============================================
// Permission Guards
// ============================================

/**
 * Require full access (admin or manager)
 * Redirects to unauthorized page if user doesn't have full access
 */
export async function requireFullAccess(redirectPath: string = '/unauthorized'): Promise<User> {
  const user = await requireAuth()

  if (!hasFullAccess(user)) {
    redirect(redirectPath)
  }

  return user
}

/**
 * Require full access (for API routes)
 * Returns null if user doesn't have full access
 */
export async function requireFullAccessAPI(): Promise<User | null> {
  const user = await requireAuthAPI()

  if (!user || !hasFullAccess(user)) {
    return null
  }

  return user
}

/**
 * Require admin role
 */
export async function requireAdmin(redirectPath: string = '/unauthorized'): Promise<User> {
  const user = await requireAuth()

  if (!isAdmin(user)) {
    redirect(redirectPath)
  }

  return user
}

/**
 * Require admin role (for API routes)
 */
export async function requireAdminAPI(): Promise<User | null> {
  const user = await requireAuthAPI()

  if (!user || !isAdmin(user)) {
    return null
  }

  return user
}

/**
 * Require manager role
 */
export async function requireManager(redirectPath: string = '/unauthorized'): Promise<User> {
  const user = await requireAuth()

  if (!isManager(user)) {
    redirect(redirectPath)
  }

  return user
}

/**
 * Require manager role (for API routes)
 */
export async function requireManagerAPI(): Promise<User | null> {
  const user = await requireAuthAPI()

  if (!user || !isManager(user)) {
    return null
  }

  return user
}

/**
 * Require admin or department-manager access.
 */
export async function requireAdminOrDepartmentManager(
  redirectPath: string = '/me',
): Promise<User> {
  const user = await requireAuth()

  if (!isAdmin(user) && !isManager(user)) {
    redirect(redirectPath)
  }

  return user
}

/**
 * Require admin or department-manager access (for API routes).
 */
export async function requireAdminOrDepartmentManagerAPI(): Promise<User | null> {
  const user = await requireAuthAPI()

  if (!user || (!isAdmin(user) && !isManager(user))) {
    return null
  }

  return user
}

/**
 * Redirect to appropriate dashboard based on role
 */
export async function redirectToDashboard() {
  const user = await requireAuth()
  redirect(getRoleRedirectPath(user))
}

// ============================================
// API Response Helpers
// ============================================

/**
 * Create unauthorized response for API routes
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 })
}

/**
 * Create forbidden response for API routes
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 })
}

/**
 * Create success response for API routes
 */
export function successResponse<T>(data: T, status: number = 200) {
  return Response.json(data, { status })
}

/**
 * Create error response for API routes
 */
export function errorResponse(message: string, status: number = 400) {
  return Response.json({ error: message }, { status })
}
