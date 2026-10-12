import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable, userDottedManagersTable, usersTable } from '@/db/schema'
import { assertDepartmentExists } from '@/lib/department-hierarchy'

const NONE_VALUE = '__none__'

export function normalizeOptionalHierarchyId(
  value: FormDataEntryValue | string | null | undefined,
) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed !== NONE_VALUE ? trimmed : null
}

export function readIndexedFormValues(formData: FormData, fieldName: string): string[] {
  const values: string[] = []
  let index = 0

  while (formData.has(`${fieldName}[${index}]`)) {
    const value = String(formData.get(`${fieldName}[${index}]`) || '').trim()
    if (value && value !== NONE_VALUE) values.push(value)
    index++
  }

  return Array.from(new Set(values))
}

type ValidateEmployeeHierarchyInput = {
  targetUserId?: string
  visibleInTeamDirectory: boolean
  departmentId: string | null
  dottedManagerIds: string[]
}

async function assertUsersExist(userIds: string[], message: string) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return

  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, uniqueUserIds))

  if (rows.length !== uniqueUserIds.length) {
    throw new Error(message)
  }
}

async function assertUsersManageDepartments(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return

  const rows = await db
    .select({ managerUserId: departmentsTable.managerUserId })
    .from(departmentsTable)
    .where(inArray(departmentsTable.managerUserId, uniqueUserIds))

  const managerIds = new Set(rows.map((row) => row.managerUserId).filter(Boolean))
  const missingManager = uniqueUserIds.some((userId) => !managerIds.has(userId))

  if (missingManager) {
    throw new Error('Dotted-line managers must manage at least one department')
  }
}

export async function validateEmployeeHierarchyInput(input: ValidateEmployeeHierarchyInput) {
  const dottedManagerIds = Array.from(new Set(input.dottedManagerIds.filter(Boolean)))

  if (input.visibleInTeamDirectory && !input.departmentId) {
    throw new Error('Visible team members must have a department')
  }

  if (dottedManagerIds.some((managerId) => managerId === input.targetUserId)) {
    throw new Error('A user cannot have themselves as a dotted-line manager')
  }

  await assertDepartmentExists(input.departmentId)
  await assertUsersExist(dottedManagerIds, 'Selected manager does not exist')
  await assertUsersManageDepartments(dottedManagerIds)
}

export async function replaceDottedManagers(userId: string, dottedManagerIds: string[]) {
  const uniqueManagerIds = Array.from(new Set(dottedManagerIds.filter(Boolean)))

  await db.delete(userDottedManagersTable).where(eq(userDottedManagersTable.userId, userId))

  if (uniqueManagerIds.length === 0) return

  await db.insert(userDottedManagersTable).values(
    uniqueManagerIds.map((managerId) => ({
      userId,
      managerId,
      createdAt: new Date().toISOString(),
    })),
  )
}

export async function getDottedManagerIds(userId: string) {
  const rows = await db
    .select({ managerId: userDottedManagersTable.managerId })
    .from(userDottedManagersTable)
    .where(eq(userDottedManagersTable.userId, userId))

  return rows.map((row) => row.managerId)
}
