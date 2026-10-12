import { db } from '@/db'
import { usersTable } from '@/db/schema'
import {
  requireAuthAPI,
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from '@/lib/auth-guards'
import { asc, eq } from 'drizzle-orm'

export async function GET() {
  const user = await requireAuthAPI()
  if (!user) {
    return unauthorizedResponse()
  }

  try {
    const users = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(asc(usersTable.fullName))

    return successResponse({
      options: users.map((option) => ({
        value: option.id,
        label: option.fullName || option.email,
      })),
    })
  } catch (error) {
    console.error('Error fetching user options:', error)
    return errorResponse('Failed to fetch user options', 500)
  }
}
