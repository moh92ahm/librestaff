import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable } from '@/db/schema/departments'
import { usersTable } from '@/db/schema/users'
import { DepartmentList } from '@/components/departments/department-list'
import { getDepartmentIdsWithDescendantsFromList } from '@/lib/department-hierarchy'
import {
  ensureRootDepartment,
  getActiveAdminManagerOptions,
  isRootDepartment,
  ROOT_DEPARTMENT_NAME,
} from '@/lib/root-department'

export const metadata: Metadata = {
  title: 'Departments',
  description: 'Manage organizational departments',
}

export default async function DepartmentsSettingsPage() {
  await ensureRootDepartment()

  const departments = await db
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
    .orderBy(asc(departmentsTable.name))

  const users = await db
    .select({
      departmentId: usersTable.departmentId,
      userId: usersTable.id,
    })
    .from(usersTable)

  const [managerOptions, rootManagerOptions] = await Promise.all([
    db
      .select({
        value: usersTable.id,
        label: usersTable.fullName,
      })
      .from(usersTable)
      .where(and(eq(usersTable.isActive, true), eq(usersTable.visibleInTeamDirectory, true)))
      .orderBy(usersTable.fullName),
    getActiveAdminManagerOptions(),
  ])

  const directUsersByDepartment = new Map<string, Set<string>>()
  for (const user of users) {
    if (!user.departmentId) continue
    const departmentUsers = directUsersByDepartment.get(user.departmentId) || new Set<string>()
    departmentUsers.add(user.userId)
    directUsersByDepartment.set(user.departmentId, departmentUsers)
  }

  const childIdsByParent = new Map<string, string[]>()
  for (const department of departments) {
    if (!department.parentDepartmentId) continue
    const childIds = childIdsByParent.get(department.parentDepartmentId) || []
    childIds.push(department.id)
    childIdsByParent.set(department.parentDepartmentId, childIds)
  }

  const managersById = new Map(
    [...managerOptions, ...rootManagerOptions].map((manager) => [manager.value, manager.label]),
  )
  const departmentsById = new Map(departments.map((department) => [department.id, department]))

  const departmentsWithManagers = departments.map((department) => {
    const inheritedManagers: Array<{ id: string; fullName: string }> = []
    let currentParentId = department.parentDepartmentId
    const visitedParentIds = new Set<string>()

    while (currentParentId && !visitedParentIds.has(currentParentId)) {
      visitedParentIds.add(currentParentId)
      const parentDepartment = departmentsById.get(currentParentId)
      if (!parentDepartment) break
      if (!isRootDepartment(parentDepartment) && parentDepartment.managerUserId) {
        const fullName = managersById.get(parentDepartment.managerUserId)
        if (fullName) {
          inheritedManagers.push({ id: parentDepartment.managerUserId, fullName })
        }
      }
      currentParentId = parentDepartment.parentDepartmentId
    }

    const directManagers = department.managerUserId
      ? [
          {
            id: department.managerUserId,
            fullName: managersById.get(department.managerUserId) || 'Unknown',
          },
        ]
      : []

    const managerMap = new Map<string, { id: string; fullName: string }>()
    for (const manager of [...inheritedManagers, ...directManagers]) {
      managerMap.set(manager.id, manager)
    }

    const users = new Set<string>()
    for (const childId of getDepartmentIdsWithDescendantsFromList(departments, [department.id])) {
      for (const userId of directUsersByDepartment.get(childId) || []) {
        users.add(userId)
      }
    }

    return {
      ...department,
      userCount: users.size,
      childCount: childIdsByParent.get(department.id)?.length || 0,
      managers: Array.from(managerMap.values()),
      inheritedManagers,
      directManagers,
      directManagerId: department.managerUserId,
    }
  })

  const parentDepartmentOptions = departments
    .filter((department) => !department.parentDepartmentId && !isRootDepartment(department))
    .map((department) => ({
      value: department.id,
      label: department.name,
    }))

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <DepartmentList
          data={departmentsWithManagers}
          managerOptions={managerOptions}
          rootManagerOptions={rootManagerOptions}
          parentDepartmentOptions={parentDepartmentOptions}
          rootDepartmentName={ROOT_DEPARTMENT_NAME}
        />
      </div>
    </div>
  )
}
