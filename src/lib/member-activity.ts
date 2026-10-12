import { db } from '@/db'
import { memberActivityLogsTable, type MemberActivityChange } from '@/db/schema'

export type MemberActivityInput = {
  subjectUserId: string | null | undefined
  actorUserId?: string | null
  eventType: string
  sourceType: string
  sourceId: string
  sourceLabel?: string | null
  metadata?: Record<string, unknown>
  sourceKey?: string | null
  createdAt?: string
}

export type ChangeField<T extends Record<string, unknown>> = {
  field: keyof T & string
  label: string
  compare?: (value: unknown) => unknown
  format?: (value: unknown) => unknown
}

function normalize(value: unknown) {
  if (value === undefined || value === '') return null
  return value
}

function comparable(value: unknown) {
  const normalized = normalize(value)
  if (typeof normalized === 'object' && normalized !== null) {
    return JSON.stringify(normalized)
  }

  return String(normalized ?? '')
}

export function getActivityChanges<T extends Record<string, unknown>>(
  previous: T,
  next: T,
  fields: Array<ChangeField<T>>,
): MemberActivityChange[] {
  return fields
    .filter(({ field, compare }) => {
      const previousValue = compare ? compare(previous[field]) : previous[field]
      const nextValue = compare ? compare(next[field]) : next[field]

      return comparable(previousValue) !== comparable(nextValue)
    })
    .map(({ field, label, format, compare }) => ({
      field,
      label,
      oldValue: format ? format(previous[field]) : compare ? compare(previous[field]) : normalize(previous[field]),
      newValue: format ? format(next[field]) : compare ? compare(next[field]) : normalize(next[field]),
    }))
}

export async function writeMemberActivityLog(input: MemberActivityInput) {
  const subjectUserId = input.subjectUserId || null
  if (!subjectUserId) return null

  const [row] = await db
    .insert(memberActivityLogsTable)
    .values({
      subjectUserId,
      actorUserId: input.actorUserId || null,
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceLabel: input.sourceLabel || null,
      metadata: input.metadata || {},
      sourceKey: input.sourceKey || null,
      createdAt: input.createdAt || new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning()

  return row || null
}

export async function writeMemberActivityLogs(inputs: MemberActivityInput[]) {
  const values = inputs
    .filter((input) => input.subjectUserId)
    .map((input) => ({
      subjectUserId: String(input.subjectUserId),
      actorUserId: input.actorUserId || null,
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceLabel: input.sourceLabel || null,
      metadata: input.metadata || {},
      sourceKey: input.sourceKey || null,
      createdAt: input.createdAt || new Date().toISOString(),
    }))

  if (values.length === 0) return []

  return db.insert(memberActivityLogsTable).values(values).onConflictDoNothing().returning()
}
