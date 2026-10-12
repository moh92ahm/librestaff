import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const getServerSession = auth

/**
 * Get current user from session
 * Helper to get user data in server components
 */
export async function getCurrentUser() {
  const session = await getServerSession()
  const user = session?.user as any
  if (!user || user.isActive !== true || user.role?.isActive === false) return null
  return session?.user
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getServerSession()
  return !!session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
