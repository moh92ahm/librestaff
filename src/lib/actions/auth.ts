'use server'

import { signIn, signOut } from '@/auth'

/**
 * Sign in with credentials
 * Server Action for login
 */
export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: 'Invalid email or password',
    }
  }
}

/**
 * Sign out the current user
 * Server Action for logout
 */
export async function logoutAction() {
  await signOut({ redirect: false })
}
