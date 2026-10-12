import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable } from '@/db/schema'

export type DepartmentNode = {
  id: string
  parentDepartmentId: string | null
}

export function getDepartmentIdsWithDescendantsFromList(
  departments: DepartmentNode[],
  departmentIds: string[],
) {
  const requestedIds = Array.from(new Set(departmentIds.filter(Boolean)))
  if (requestedIds.length === 0) return []

  const childIdsByParent = new Map<string, string[]>()
  for (const department of departments) {
    if (!department.parentDepartmentId) continue
    const childIds = childIdsByParent.get(department.parentDepartmentId) || []
    childIds.push(department.id)
    childIdsByParent.set(department.parentDepartmentId, childIds)
  }

  const result = new Set<string>()
  const queue = [...requestedIds]

  while (queue.length > 0) {
    const departmentId = queue.shift()
    if (!departmentId || result.has(departmentId)) continue

    result.add(departmentId)
    queue.push(...(childIdsByParent.get(departmentId) || []))
  }

  return Array.from(result)
}

export function getDepartmentIdsWithAncestorsFromList(
  departments: DepartmentNode[],
  departmentId: string | null | undefined,
) {
  if (!departmentId) return []

  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const result: string[] = []
  const visited = new Set<string>()
  let currentDepartmentId: string | null | undefined = departmentId

  while (currentDepartmentId && !visited.has(currentDepartmentId)) {
    visited.add(currentDepartmentId)
    result.push(currentDepartmentId)
    currentDepartmentId = departmentsById.get(currentDepartmentId)?.parentDepartmentId
  }

  return result
}

export async function getDepartmentIdsWithDescendants(departmentIds: string[]) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean)))
  if (ids.length === 0) return []

  const departments = await db
    .select({
      id: departmentsTable.id,
      parentDepartmentId: departmentsTable.parentDepartmentId,
    })
    .from(departmentsTable)

  return getDepartmentIdsWithDescendantsFromList(departments, ids)
}

export async function getDepartmentIdsWithAncestors(departmentId: string | null | undefined) {
  if (!departmentId) return []

  const departments = await db
    .select({
      id: departmentsTable.id,
      parentDepartmentId: departmentsTable.parentDepartmentId,
    })
    .from(departmentsTable)

  return getDepartmentIdsWithAncestorsFromList(departments, departmentId)
}

export async function assertDepartmentExists(departmentId: string | null | undefined) {
  if (!departmentId) return

  const [department] = await db
    .select({ id: departmentsTable.id })
    .from(departmentsTable)
    .where(eq(departmentsTable.id, departmentId))
    .limit(1)

  if (!department) {
    throw new Error('Selected department does not exist')
  }
}

export async function getDepartmentRowsByIds(departmentIds: string[]) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean)))
  if (ids.length === 0) return []

  return db
    .select({
      id: departmentsTable.id,
      parentDepartmentId: departmentsTable.parentDepartmentId,
    })
    .from(departmentsTable)
    .where(inArray(departmentsTable.id, ids))
}
