import { and, eq } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

export const PERSON_TYPES = [
  'employee',
  'contractor',
  'consultant',
  'external',
  'serviceAccount',
] as const

export type PersonType = (typeof PERSON_TYPES)[number]

export const personTypeOptions: Array<{ value: PersonType; label: string }> = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'external', label: 'External' },
  { value: 'serviceAccount', label: 'Service Account' },
]

export function activeEmployeeWhere() {
  return and(eq(usersTable.isActive, true), eq(usersTable.personType, 'employee'))
}

export function headcountWhere() {
  return eq(usersTable.includeInHeadcount, true)
}

export function visibleTeamDirectoryWhere() {
  return eq(usersTable.visibleInTeamDirectory, true)
}
