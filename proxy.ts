import { auth } from '@/auth'
import { NextResponse } from 'next/server'

type SessionUserWithRole = {
  isActive?: boolean
  role?: {
    name?: 'admin' | 'member' | 'manager' | 'employee'
    isActive?: boolean
  }
  managedDepartments?: Array<{
    departmentId?: string
  }>
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup', '/apply', '/api/signup']

// Routes that bypass proxy checks completely
const BYPASS_ROUTES = ['/_next', '/static', '/favicon.ico', '/media']

// Settings remain admin-only at the proxy because they manage account-wide controls.
// Other modules are checked by server pages/actions with database-backed permissions.
const ADMIN_ROUTES = ['/admin', '/settings']

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const user = req.auth?.user as SessionUserWithRole | undefined

  // Bypass proxy checks for static assets
  if (BYPASS_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    // If already logged in and accessing login page, redirect to appropriate dashboard
    if (isLoggedIn && pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = user?.role?.name
  const hasAdminAccess = role === 'admin'

  if (user?.isActive !== true || user.role?.isActive === false) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Compatibility redirects for the old employee portal and users area.
  if (pathname === '/profile') {
    return NextResponse.redirect(new URL('/me', req.url))
  }
  if (pathname === '/profile/calendar') {
    return NextResponse.redirect(new URL('/calendar', req.url))
  }
  if (pathname === '/profile/leaves/new') {
    return NextResponse.redirect(new URL('/me/leaves/new', req.url))
  }
  if (pathname.startsWith('/profile/announcements/')) {
    return NextResponse.redirect(new URL(pathname.replace('/profile', ''), req.url))
  }
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    return NextResponse.redirect(new URL(pathname.replace('/users', '/team-members'), req.url))
  }
  if (pathname === '/settings/hierarchy') {
    return NextResponse.redirect(new URL('/organization', req.url))
  }

  const isAdminOnlyRoute = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  )

  if (isAdminOnlyRoute && !hasAdminAccess) {
    return NextResponse.redirect(new URL('/me', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
