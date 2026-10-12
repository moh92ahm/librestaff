import { NextRequest } from 'next/server'
import { db } from '@/db'
import { departmentsTable } from '@/db/schema/departments'
import { usersTable } from '@/db/schema/users'
import { eq, desc } from 'drizzle-orm'
import {
  requireFullAccessAPI,
  successResponse,
  errorResponse,
  forbiddenResponse,
} from '@/lib/auth-guards'
import { isAdmin } from '@/lib/rbac'
import {
  isActiveAdminUser,
  isRootDepartment,
  isRootDepartmentName,
  ROOT_DEPARTMENT_NAME,
} from '@/lib/root-department'

function normalizeManagerUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeParentDepartmentId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function validateParentDepartment(parentDepartmentId: string | null) {
  if (!parentDepartmentId) return null

  const [parentDepartment] = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      parentDepartmentId: departmentsTable.parentDepartmentId,
    })
    .from(departmentsTable)
    .where(eq(departmentsTable.id, parentDepartmentId))
    .limit(1)

  if (!parentDepartment) {
    return 'Parent department not found'
  }

  if (isRootDepartment(parentDepartment)) {
    return `${ROOT_DEPARTMENT_NAME} does not need to be selected as a parent`
  }

  if (parentDepartment.parentDepartmentId) {
    return 'A child department cannot be selected as a parent'
  }

  return null
}

/**
 * GET /api/admin/departments
 * List all departments with user counts
 * Requires: admin or manager role
 */
export async function GET() {
  // Check authentication and permissions
  const user = await requireFullAccessAPI()
  if (!user) {
    return forbiddenResponse('Admin or Manager access required')
  }

  try {
    const [departments, userDepartments] = await Promise.all([
      db
        .select({
          id: departmentsTable.id,
          name: departmentsTable.name,
          parentDepartmentId: departmentsTable.parentDepartmentId,
          managerUserId: departmentsTable.managerUserId,
          description: departmentsTable.description,
          isActive: departmentsTable.isActive,
          createdAt: departmentsTable.createdAt,
          updatedAt: departmentsTable.updatedAt,
        })
        .from(departmentsTable)
        .orderBy(desc(departmentsTable.createdAt)),
      db
        .select({
          departmentId: usersTable.departmentId,
          userId: usersTable.id,
        })
        .from(usersTable),
    ])

    const directUsersByDepartment = new Map<string, Set<string>>()
    for (const userDepartment of userDepartments) {
      if (!userDepartment.departmentId) continue
      const current = directUsersByDepartment.get(userDepartment.departmentId) || new Set<string>()
      current.add(userDepartment.userId)
      directUsersByDepartment.set(userDepartment.departmentId, current)
    }

    const childIdsByParent = new Map<string, string[]>()
    for (const department of departments) {
      if (!department.parentDepartmentId) continue
      const current = childIdsByParent.get(department.parentDepartmentId) || []
      current.push(department.id)
      childIdsByParent.set(department.parentDepartmentId, current)
    }

    const allDepartments = departments.map((department) => {
      const users = new Set(directUsersByDepartment.get(department.id) || [])

      for (const childId of childIdsByParent.get(department.id) || []) {
        for (const userId of directUsersByDepartment.get(childId) || []) {
          users.add(userId)
        }
      }

      return {
        ...department,
        userCount: users.size,
      }
    })

    return successResponse({
      departments: allDepartments,
      total: allDepartments.length,
    })
  } catch (error) {
    console.error('Error fetching departments:', error)
    return errorResponse('Failed to fetch departments', 500)
  }
}

/**
 * POST /api/admin/departments
 * Create a new department
 * Requires: admin or manager role
 */
export async function POST(request: NextRequest) {
  // Check authentication and permissions
  const user = await requireFullAccessAPI()
  if (!user) {
    return forbiddenResponse('Admin or Manager access required')
  }

  try {
    const body = await request.json()
    const { name, description, isActive } = body
    const managerUserId = normalizeManagerUserId(body.managerUserId)
    const parentDepartmentId = normalizeParentDepartmentId(body.parentDepartmentId)
    const isCreatingRootDepartment = isRootDepartmentName(name)

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('Department name is required')
    }

    if (name.length > 100) {
      return errorResponse('Department name must be 100 characters or less')
    }

    const parentError = await validateParentDepartment(parentDepartmentId)
    if (parentError) {
      return errorResponse(parentError, 400)
    }

    if (isCreatingRootDepartment) {
      if (!isAdmin(user)) {
        return forbiddenResponse(`${ROOT_DEPARTMENT_NAME} can only be managed by admins`)
      }
      if (parentDepartmentId) {
        return errorResponse(`${ROOT_DEPARTMENT_NAME} cannot have a parent department`, 400)
      }
      if (!(await isActiveAdminUser(managerUserId))) {
        return errorResponse(`${ROOT_DEPARTMENT_NAME} manager must be an active admin`, 400)
      }
      if (isActive === false) {
        return errorResponse(`${ROOT_DEPARTMENT_NAME} department cannot be deactivated`, 400)
      }
    }

    // Check if department with same name already exists
    const existing = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.name, name.trim()))
      .limit(1)

    if (existing.length > 0) {
      return errorResponse('A department with this name already exists')
    }

    const [newDepartment] = await db.transaction(async (tx) => {
      const [department] = await tx
        .insert(departmentsTable)
        .values({
          name: name.trim(),
          parentDepartmentId,
          managerUserId,
          description: description?.trim() || null,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        })
        .returning()

      return [department]
    })

    return successResponse(
      {
        department: newDepartment,
        message: 'Department created successfully',
      },
      201,
    )
  } catch (error) {
    console.error('Error creating department:', error)
    return errorResponse('Failed to create department', 500)
  }
}
