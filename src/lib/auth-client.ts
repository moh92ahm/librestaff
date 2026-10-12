'use client'

import { useSession as useNextAuthSession } from 'next-auth/react'

export function useSession() {
  return useNextAuthSession()
}

/**
 * Hook to get current user from session
 */
export function useCurrentUser() {
  const { data: session } = useSession()
  return session?.user
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated() {
  const { data: session, status } = useSession()
  return {
    isAuthenticated: !!session?.user,
    isLoading: status === 'loading',
  }
}
