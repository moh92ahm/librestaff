import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { departmentsTable, usersTable } from '@/db/schema'
import { getManagedDepartmentIds, getManagedUserIds } from '@/lib/manager-permissions'
import { getDepartmentIdsWithAncestors } from '@/lib/department-hierarchy'
import { isAdmin, isManager, type User } from '@/lib/rbac'

export async function getCommunicationFormOptions() {
  const [departments, users] = await Promise.all([
    db
      .select({
        value: departmentsTable.id,
        label: departmentsTable.name,
      })
      .from(departmentsTable)
      .where(eq(departmentsTable.isActive, true))
      .orderBy(departmentsTable.name),
    db
      .select({
        value: usersTable.id,
        label: usersTable.fullName,
        departmentId: usersTable.departmentId,
      })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.fullName),
  ])

  const userDepartmentRows = await Promise.all(
    users.map(async (user) => ({
      userId: user.value,
      departmentIds: await getDepartmentIdsWithAncestors(user.departmentId),
    })),
  )

  return {
    departments,
    users: users.map((user) => ({
      ...user,
      departmentIds:
        userDepartmentRows.find((row) => row.userId === user.value)?.departmentIds || [],
    })),
  }
}

export async function getCommunicationFormOptionsForUser(user: User) {
  if (isAdmin(user) || !isManager(user)) {
    return getCommunicationFormOptions()
  }

  const [departmentIds, userIds] = await Promise.all([
    getManagedDepartmentIds(user.id),
    getManagedUserIds(user.id),
  ])

  if (departmentIds.length === 0) {
    return { departments: [], users: [] }
  }

  const [departments, users] = await Promise.all([
    db
      .select({
        value: departmentsTable.id,
        label: departmentsTable.name,
      })
      .from(departmentsTable)
      .where(and(eq(departmentsTable.isActive, true), inArray(departmentsTable.id, departmentIds)))
      .orderBy(departmentsTable.name),
    userIds.length > 0
      ? db
          .select({
            value: usersTable.id,
            label: usersTable.fullName,
            departmentId: usersTable.departmentId,
          })
          .from(usersTable)
          .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, userIds)))
          .orderBy(usersTable.fullName)
      : [],
  ])

  const userDepartmentRows = await Promise.all(
    users.map(async (option) => ({
      userId: option.value,
      departmentIds: await getDepartmentIdsWithAncestors(option.departmentId),
    })),
  )

  return {
    departments,
    users: users.map((option) => ({
      ...option,
      departmentIds:
        userDepartmentRows.find((row) => row.userId === option.value)?.departmentIds || [],
    })),
  }
}
