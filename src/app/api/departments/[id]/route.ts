import { NextRequest } from 'next/server'
import { db } from '@/db'
import { departmentsTable } from '@/db/schema/departments'
import { usersTable } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
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

async function validateParentDepartment(
  parentDepartmentId: string | null,
  currentDepartmentId: string,
) {
  if (!parentDepartmentId) return null

  if (parentDepartmentId === currentDepartmentId) {
    return 'A department cannot be its own parent'
  }

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

  const childDepartments = await db
    .select({ id: departmentsTable.id })
    .from(departmentsTable)
    .where(eq(departmentsTable.parentDepartmentId, currentDepartmentId))
    .limit(1)

  if (childDepartments.length > 0) {
    return 'A parent department cannot be moved under another parent'
  }

  return null
}

/**
 * GET /api/admin/departmentsTable/[id]
 * Get a single department by ID
 * Requires: admin or manager role
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check authentication and permissions
  const user = await requireFullAccessAPI()
  if (!user) {
    return forbiddenResponse('Admin or Manager access required')
  }

  try {
    const { id } = await params

    const [department] = await db
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
      .where(eq(departmentsTable.id, id))
      .limit(1)

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    const userDepartments = await db
      .select({
        departmentId: usersTable.departmentId,
        userId: usersTable.id,
      })
      .from(usersTable)

    const childDepartments = await db
      .select({ id: departmentsTable.id })
      .from(departmentsTable)
      .where(eq(departmentsTable.parentDepartmentId, id))

    const departmentUserIds = new Set<string>()
    for (const userDepartment of userDepartments) {
      if (!userDepartment.departmentId) continue
      if (userDepartment.departmentId === id) {
        departmentUserIds.add(userDepartment.userId)
      }
    }

    for (const childDepartment of childDepartments) {
      for (const userDepartment of userDepartments) {
        if (userDepartment.departmentId === childDepartment.id) {
          departmentUserIds.add(userDepartment.userId)
        }
      }
    }

    return successResponse({ department: { ...department, userCount: departmentUserIds.size } })
  } catch (error) {
    console.error('Error fetching department:', error)
    return errorResponse('Failed to fetch department', 500)
  }
}

/**
 * PUT /api/admin/departmentsTable/[id]
 * Update a department
 * Requires: admin or manager role
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check authentication and permissions
  const user = await requireFullAccessAPI()
  if (!user) {
    return forbiddenResponse('Admin or Manager access required')
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, isActive } = body
    const managerUserId = normalizeManagerUserId(body.managerUserId)
    const parentDepartmentId = normalizeParentDepartmentId(body.parentDepartmentId)

    // Check if department exists
    const [existing] = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.id, id))
      .limit(1)

    if (!existing) {
      return errorResponse('Department not found', 404)
    }

    const editingRootDepartment = isRootDepartment(existing)
    if (editingRootDepartment && !isAdmin(user)) {
      return forbiddenResponse(`${ROOT_DEPARTMENT_NAME} can only be managed by admins`)
    }

    // Validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return errorResponse('Department name cannot be empty')
      }

      if (name.length > 100) {
        return errorResponse('Department name must be 100 characters or less')
      }

      if (editingRootDepartment && !isRootDepartmentName(name)) {
        return errorResponse(`${ROOT_DEPARTMENT_NAME} department cannot be renamed`, 400)
      }

      // Check if another department has this name
      const duplicate = await db
        .select()
        .from(departmentsTable)
        .where(eq(departmentsTable.name, name.trim()))
        .limit(1)

      if (duplicate.length > 0 && duplicate[0].id !== id) {
        return errorResponse('A department with this name already exists')
      }
    }

    if ('parentDepartmentId' in body) {
      if (editingRootDepartment && parentDepartmentId) {
        return errorResponse(`${ROOT_DEPARTMENT_NAME} cannot have a parent department`, 400)
      }
      const parentError = await validateParentDepartment(parentDepartmentId, id)
      if (parentError) {
        return errorResponse(parentError, 400)
      }
    }

    if (editingRootDepartment && managerUserId && !(await isActiveAdminUser(managerUserId))) {
      return errorResponse(`${ROOT_DEPARTMENT_NAME} manager must be an active admin`, 400)
    }

    if (editingRootDepartment && isActive === false) {
      return errorResponse(`${ROOT_DEPARTMENT_NAME} department cannot be deactivated`, 400)
    }

    const [updated] = await db.transaction(async (tx) => {
      const [department] = await tx
        .update(departmentsTable)
        .set({
          ...(name !== undefined && { name: name.trim() }),
          ...('parentDepartmentId' in body && { parentDepartmentId }),
          ...('managerUserId' in body && { managerUserId }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(departmentsTable.id, id))
        .returning()

      return [department]
    })

    return successResponse({
      department: updated,
      message: 'Department updated successfully',
    })
  } catch (error) {
    console.error('Error updating department:', error)
    return errorResponse('Failed to update department', 500)
  }
}

/**
 * DELETE /api/admin/departmentsTable/[id]
 * Delete a department
 * Requires: admin or manager role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Check authentication and permissions
  const user = await requireFullAccessAPI()
  if (!user) {
    return forbiddenResponse('Admin or Manager access required')
  }

  try {
    const { id } = await params

    // Check if department exists
    const [existing] = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.id, id))
      .limit(1)

    if (!existing) {
      return errorResponse('Department not found', 404)
    }

    if (isRootDepartment(existing)) {
      return errorResponse(`${ROOT_DEPARTMENT_NAME} department cannot be deleted`, 400)
    }

    const childCountResult = await db
      .select({ id: departmentsTable.id })
      .from(departmentsTable)
      .where(eq(departmentsTable.parentDepartmentId, id))
      .limit(1)

    if (childCountResult.length > 0) {
      return errorResponse(
        'Cannot delete department with child departments. Move or delete child departments first.',
        400,
      )
    }

    // Check if department has users
    const [userCountResult] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.departmentId, id))
      .limit(1)

    if (userCountResult) {
      return errorResponse(
        'Cannot delete department with assigned user(s). Please reassign users first.',
        400,
      )
    }

    // Delete department
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id))

    return successResponse({
      message: 'Department deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting department:', error)
    return errorResponse('Failed to delete department', 500)
  }
}
