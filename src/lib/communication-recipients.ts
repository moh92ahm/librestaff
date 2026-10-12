import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { usersTable } from '@/db/schema'
import { getDepartmentIdsWithDescendants } from '@/lib/department-hierarchy'

export type CommunicationTargetType = 'everyone' | 'departments' | 'users'

export type CommunicationRecipient = {
  id: string
  fullName: string
  email: string
}

export type CommunicationTargetInput = {
  targetType: CommunicationTargetType
  departmentIds?: string[]
  userIds?: string[]
}

export function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
}

export function normalizeTargetType(value: string): CommunicationTargetType {
  return value === 'departments' || value === 'users' ? value : 'everyone'
}

export function assertTargetSelection(input: CommunicationTargetInput) {
  if (input.targetType === 'departments' && uniqueIds(input.departmentIds || []).length === 0) {
    throw new Error('Select at least one department.')
  }

  if (input.targetType === 'users' && uniqueIds(input.userIds || []).length === 0) {
    throw new Error('Select at least one user.')
  }
}

export async function resolveCommunicationRecipients(
  input: CommunicationTargetInput,
): Promise<CommunicationRecipient[]> {
  assertTargetSelection(input)

  if (input.targetType === 'everyone') {
    return db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.fullName)
  }

  if (input.targetType === 'users') {
    const userIds = uniqueIds(input.userIds || [])
    if (userIds.length === 0) return []

    const users = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, userIds)))
      .orderBy(usersTable.fullName)

    return dedupeRecipients(users)
  }

  const departmentIds = await getDepartmentIdsWithDescendants(uniqueIds(input.departmentIds || []))
  if (departmentIds.length === 0) return []

  const users = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(
      and(eq(usersTable.isActive, true), inArray(usersTable.departmentId, departmentIds)),
    )
    .orderBy(usersTable.fullName)

  return dedupeRecipients(users)
}

export function dedupeRecipients(recipients: CommunicationRecipient[]) {
  const seen = new Set<string>()
  return recipients.filter((recipient) => {
    if (seen.has(recipient.id)) return false
    seen.add(recipient.id)
    return true
  })
}
