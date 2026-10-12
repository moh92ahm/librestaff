import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable, userDottedManagersTable, usersTable } from '@/db/schema'
import {
  EmployeeHierarchyChart,
  type HierarchyPerson,
} from '@/components/settings/employee-hierarchy-chart'
import { requireAuth } from '@/lib/auth-guards'
import { getScopedUserIds } from '@/lib/permissions'
import { ensureRootDepartment, ROOT_DEPARTMENT_NAME } from '@/lib/root-department'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('organization')

  return {
    title: t('title'),
    description: t('metadataDescription'),
  }
}

export default async function OrganizationPage() {
  const currentUser = await requireAuth()
  const [rootDepartment, scopedUserIds, people, departments, dottedManagerRows] = await Promise.all([
    ensureRootDepartment(),
    getScopedUserIds(currentUser, 'employees', 'view'),
    db.query.usersTable.findMany({
      where: and(eq(usersTable.isActive, true), eq(usersTable.visibleInTeamDirectory, true)),
      orderBy: (users, { asc }) => [asc(users.fullName)],
      with: {
        department: true,
      },
    }),
    db
      .select({
        id: departmentsTable.id,
        name: departmentsTable.name,
        parentDepartmentId: departmentsTable.parentDepartmentId,
        managerUserId: departmentsTable.managerUserId,
      })
      .from(departmentsTable)
      .where(eq(departmentsTable.isActive, true))
      .orderBy(asc(departmentsTable.name)),
    db
      .select({
        userId: userDottedManagersTable.userId,
        managerId: userDottedManagersTable.managerId,
      })
      .from(userDottedManagersTable),
  ])
  const linkableUserIds = scopedUserIds === null ? null : new Set(scopedUserIds)

  const peopleById = new Map(people.map((person) => [person.id, person]))
  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const dottedManagersByUserId = new Map<string, Array<{ id: string; fullName: string }>>()

  for (const row of dottedManagerRows) {
    const manager = peopleById.get(row.managerId)
    if (!manager) continue

    const managers = dottedManagersByUserId.get(row.userId) || []
    managers.push({ id: manager.id, fullName: manager.fullName })
    dottedManagersByUserId.set(row.userId, managers)
  }

  function effectiveDepartments(departmentId: string | null) {
    const result: Array<{ id: string; name: string }> = []
    const visited = new Set<string>()
    let currentDepartmentId: string | null | undefined = departmentId

    while (currentDepartmentId && !visited.has(currentDepartmentId)) {
      visited.add(currentDepartmentId)
      const department = departmentsById.get(currentDepartmentId)
      if (!department) break
      result.push({ id: department.id, name: department.name })
      currentDepartmentId = department.parentDepartmentId
    }

    return result
  }

  const hierarchyPeople: HierarchyPerson[] = people.map((person) => ({
    id: person.id,
    fullName: person.fullName,
    photo: person.photo,
    jobTitle: person.jobTitle,
    departmentId: person.departmentId,
    isProtectedAdmin: person.isProtectedAdmin,
    departments: effectiveDepartments(person.departmentId),
    dottedManagers: dottedManagersByUserId.get(person.id) || [],
    canViewProfile: linkableUserIds === null || linkableUserIds.has(person.id),
  }))

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <EmployeeHierarchyChart
        people={hierarchyPeople}
        rootDepartmentName={ROOT_DEPARTMENT_NAME}
        rootManagerId={rootDepartment?.managerUserId || null}
        departments={departments.map((department) => ({
          ...department,
        }))}
      />
    </div>
  )
}
