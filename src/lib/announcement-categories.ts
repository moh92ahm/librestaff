import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  announcementCategoriesTable,
  announcementChannelDepartmentMembersTable,
  announcementChannelUserMembersTable,
  departmentsTable,
  usersTable,
} from '@/db/schema'
import { getDepartmentIdsWithAncestors } from '@/lib/department-hierarchy'
import {
  dedupeRecipients,
  resolveCommunicationRecipients,
  type CommunicationRecipient,
} from '@/lib/communication-recipients'
import { hasFullAccess, type User } from '@/lib/rbac'

export const GENERAL_ANNOUNCEMENT_CATEGORY_ID = 'general'
export const GENERAL_ANNOUNCEMENT_CATEGORY_NAME = 'General'
export const GENERAL_ANNOUNCEMENT_CATEGORY_COLOR = '#94a3b8'

export type AnnouncementCategoryOption = {
  id: string
  name: string
  color: string
  visibility: 'public' | 'private'
  createdById: string | null
  notifyInApp: boolean
  notifyEmail: boolean
  departmentIds: string[]
  userIds: string[]
}

export type AnnouncementChannelMemberPreview = {
  channelId: string
  channelName: string
  members: Array<{
    id: string
    fullName: string
    photo: string | null
    jobTitle: string | null
    departmentNames: string[]
  }>
}

export function isGeneralAnnouncementCategory(category: Pick<AnnouncementCategoryOption, 'name'>) {
  return category.name.trim().toLowerCase() === GENERAL_ANNOUNCEMENT_CATEGORY_NAME.toLowerCase()
}

export async function getOrCreateGeneralAnnouncementCategory(): Promise<AnnouncementCategoryOption> {
  const [existingById] = await db
    .select({
      id: announcementCategoriesTable.id,
      name: announcementCategoriesTable.name,
      color: announcementCategoriesTable.color,
      visibility: announcementCategoriesTable.visibility,
      createdById: announcementCategoriesTable.createdById,
      notifyInApp: announcementCategoriesTable.notifyInApp,
      notifyEmail: announcementCategoriesTable.notifyEmail,
    })
    .from(announcementCategoriesTable)
    .where(sql`${announcementCategoriesTable.id} = ${GENERAL_ANNOUNCEMENT_CATEGORY_ID}`)
    .limit(1)

  if (existingById) return { ...existingById, departmentIds: [], userIds: [] }

  const [existingByName] = await db
    .select({
      id: announcementCategoriesTable.id,
      name: announcementCategoriesTable.name,
      color: announcementCategoriesTable.color,
      visibility: announcementCategoriesTable.visibility,
      createdById: announcementCategoriesTable.createdById,
      notifyInApp: announcementCategoriesTable.notifyInApp,
      notifyEmail: announcementCategoriesTable.notifyEmail,
    })
    .from(announcementCategoriesTable)
    .where(sql`lower(${announcementCategoriesTable.name}) = ${GENERAL_ANNOUNCEMENT_CATEGORY_NAME.toLowerCase()}`)
    .limit(1)

  if (existingByName) return { ...existingByName, departmentIds: [], userIds: [] }

  const [created] = await db
    .insert(announcementCategoriesTable)
    .values({
      id: GENERAL_ANNOUNCEMENT_CATEGORY_ID,
      name: GENERAL_ANNOUNCEMENT_CATEGORY_NAME,
      color: GENERAL_ANNOUNCEMENT_CATEGORY_COLOR,
      visibility: 'public',
      notifyInApp: true,
      notifyEmail: false,
    })
    .returning({
      id: announcementCategoriesTable.id,
      name: announcementCategoriesTable.name,
      color: announcementCategoriesTable.color,
      visibility: announcementCategoriesTable.visibility,
      createdById: announcementCategoriesTable.createdById,
      notifyInApp: announcementCategoriesTable.notifyInApp,
      notifyEmail: announcementCategoriesTable.notifyEmail,
    })

  return { ...created, departmentIds: [], userIds: [] }
}

export async function getAnnouncementCategories(): Promise<AnnouncementCategoryOption[]> {
  const general = await getOrCreateGeneralAnnouncementCategory()
  const categories = await db
    .select({
      id: announcementCategoriesTable.id,
      name: announcementCategoriesTable.name,
      color: announcementCategoriesTable.color,
      visibility: announcementCategoriesTable.visibility,
      createdById: announcementCategoriesTable.createdById,
      notifyInApp: announcementCategoriesTable.notifyInApp,
      notifyEmail: announcementCategoriesTable.notifyEmail,
    })
    .from(announcementCategoriesTable)
    .orderBy(announcementCategoriesTable.name)

  const categoryIds = categories.map((category) => category.id)
  const [departmentMembers, userMembers] = categoryIds.length > 0
    ? await Promise.all([
        db
          .select({
            channelId: announcementChannelDepartmentMembersTable.channelId,
            departmentId: announcementChannelDepartmentMembersTable.departmentId,
          })
          .from(announcementChannelDepartmentMembersTable)
          .where(inArray(announcementChannelDepartmentMembersTable.channelId, categoryIds)),
        db
          .select({
            channelId: announcementChannelUserMembersTable.channelId,
            userId: announcementChannelUserMembersTable.userId,
          })
          .from(announcementChannelUserMembersTable)
          .where(inArray(announcementChannelUserMembersTable.channelId, categoryIds)),
      ])
    : [[], []]

  return categories.sort((a, b) => {
    if (a.id === general.id) return -1
    if (b.id === general.id) return 1
    return a.name.localeCompare(b.name)
  }).map((category) => ({
    ...category,
    departmentIds: departmentMembers
      .filter((member) => member.channelId === category.id)
      .map((member) => member.departmentId),
    userIds: userMembers
      .filter((member) => member.channelId === category.id)
      .map((member) => member.userId),
  }))
}

export async function resolveAnnouncementCategoryId(value: string | null | undefined) {
  const categoryId = String(value || '').trim()
  if (categoryId) return categoryId
  return (await getOrCreateGeneralAnnouncementCategory()).id
}

export async function getVisibleAnnouncementChannels(user: User) {
  const allChannels = await getAnnouncementCategories()
  if (hasFullAccess(user)) return allChannels

  const [currentUser] = await db
    .select({ departmentId: usersTable.departmentId })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1)
  const userDepartmentIds = new Set(await getDepartmentIdsWithAncestors(currentUser?.departmentId))

  return allChannels.filter((channel) => {
    if (channel.visibility === 'public') return true
    if (channel.userIds.includes(user.id)) return true
    return channel.departmentIds.some((departmentId) => userDepartmentIds.has(departmentId))
  })
}

export async function resolveAnnouncementChannelRecipients(
  channel: Pick<AnnouncementCategoryOption, 'visibility' | 'departmentIds' | 'userIds'>,
): Promise<CommunicationRecipient[]> {
  if (channel.visibility === 'public') {
    return resolveCommunicationRecipients({ targetType: 'everyone' })
  }

  const recipients: CommunicationRecipient[] = []
  if (channel.departmentIds.length > 0) {
    recipients.push(
      ...(await resolveCommunicationRecipients({
        targetType: 'departments',
        departmentIds: channel.departmentIds,
      })),
    )
  }
  if (channel.userIds.length > 0) {
    recipients.push(
      ...(await resolveCommunicationRecipients({
        targetType: 'users',
        userIds: channel.userIds,
      })),
    )
  }

  return dedupeRecipients(recipients)
}

export async function getAnnouncementChannelById(id: string) {
  const channels = await getAnnouncementCategories()
  return channels.find((channel) => channel.id === id) || null
}

export async function getAnnouncementMentionOptions(user: User) {
  const channels = await getVisibleAnnouncementChannels(user)
  const entries = await Promise.all(
    channels.map(async (channel) => {
      const recipients = await resolveAnnouncementChannelRecipients(channel)
      return [
        channel.id,
        recipients.map((recipient) => ({
          value: recipient.id,
          label: recipient.fullName,
        })),
      ] as const
    }),
  )

  return Object.fromEntries(entries)
}

export async function getPrivateAnnouncementChannelMemberPreview(
  channel: AnnouncementCategoryOption | null | undefined,
): Promise<AnnouncementChannelMemberPreview | null> {
  if (!channel || channel.visibility !== 'private') return null

  const recipients = await resolveAnnouncementChannelRecipients(channel)
  const recipientIds = recipients.map((recipient) => recipient.id)
  if (recipientIds.length === 0) {
    return {
      channelId: channel.id,
      channelName: channel.name,
      members: [],
    }
  }

  const rows = await db
    .select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      photo: usersTable.photo,
      jobTitle: usersTable.jobTitle,
      departmentName: departmentsTable.name,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(inArray(usersTable.id, recipientIds))
    .orderBy(usersTable.fullName, departmentsTable.name)

  const membersById = new Map<string, AnnouncementChannelMemberPreview['members'][number]>()
  for (const row of rows) {
    const existing = membersById.get(row.id)
    if (existing) {
      if (row.departmentName && !existing.departmentNames.includes(row.departmentName)) {
        existing.departmentNames.push(row.departmentName)
      }
      continue
    }

    membersById.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      photo: row.photo ?? null,
      jobTitle: row.jobTitle ?? null,
      departmentNames: row.departmentName ? [row.departmentName] : [],
    })
  }

  return {
    channelId: channel.id,
    channelName: channel.name,
    members: Array.from(membersById.values()),
  }
}
