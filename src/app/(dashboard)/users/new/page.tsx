import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { requirePermission } from '@/lib/permissions'
import { UserForm } from '@/components/user/forms/user-form'
import { and, asc, eq } from 'drizzle-orm'
import { departmentsTable, rolesTable, usersTable } from '@/db/schema'
import { setFlashToast } from '@/lib/flash-toast'
import {
  normalizeOptionalHierarchyId,
  readIndexedFormValues,
  replaceDottedManagers,
  validateEmployeeHierarchyInput,
} from '@/lib/employee-hierarchy'
import {
  emitNotificationEvent,
  getUsersByIdsForNotifications,
  NOTIFICATION_EVENTS,
  toNotificationRecipients,
} from '@/lib/notification-events'
import { normalizeUsername } from '@/lib/usernames'
import { normalizePhoneNumber } from '@/lib/phone-numbers'
import { normalizeDisplayText } from '@/lib/display-text'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { writeMemberActivityLog } from '@/lib/member-activity'
import { assertPasswordLength } from '@/lib/password-policy'

export const metadata: Metadata = {
  title: 'New User',
  description: 'Create a new user',
}

export default async function NewUserPage() {
  await requirePermission('employees', 'create')

  // Fetch departments and roles for dropdowns
  const [departments, roles, managerOptions] = await Promise.all([
    db.select().from(departmentsTable).orderBy(asc(departmentsTable.name)),
    db.select().from(rolesTable).where(eq(rolesTable.isActive, true)).orderBy(asc(rolesTable.name)),
    db
      .select({
        value: usersTable.id,
        label: usersTable.fullName,
        jobTitle: usersTable.jobTitle,
      })
      .from(departmentsTable)
      .innerJoin(usersTable, eq(departmentsTable.managerUserId, usersTable.id))
      .where(and(eq(usersTable.isActive, true), eq(usersTable.visibleInTeamDirectory, true)))
      .orderBy(asc(usersTable.fullName)),
  ])

  const handleCreateUser = async (formData: FormData) => {
    'use server'

    const actor = await requirePermission('employees', 'create')

    // Handle photo upload via API if file is provided
    let photoPath: string | null = null
    const photo = formData.get('photo') as File | null
    const fullName = normalizeDisplayText(formData.get('fullName'))
    if (photo && typeof photo === 'object' && 'arrayBuffer' in photo && photo.size > 0) {
      const media = await saveUploadedMedia({
        file: photo,
        category: 'employee-photos',
        allowedMimeTypes: imageMimeTypes,
        alt: `${fullName} photo`,
      })
      photoPath = media.url
    }

    // Auth fields
    const email = String(formData.get('email') || '')
    const username = normalizeUsername(formData.get('username'))
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')
    if (!email) throw new Error('Email is required')
    if (!username || !password) throw new Error('Username and password are required')
    assertPasswordLength(password)
    if (password !== confirmPassword) throw new Error('Passwords do not match')

    // Normalize optional fields
    const jobTitle = normalizeDisplayText(formData.get('jobTitle'))
    const secondaryPhone = normalizePhoneNumber(formData.get('secondaryPhone'))
    const secondaryEmail = String(formData.get('secondaryEmail') || '')

    // Create the new user (team member)
    const userData: any = {
      fullName,
      ...(photoPath && { photo: photoPath }),
      birthDate: String(formData.get('birthDate') || ''),
      primaryPhone: normalizePhoneNumber(formData.get('primaryPhone')),
      joinedAt: String(formData.get('joinedAt') || new Date().toISOString()),
      employmentType: String(formData.get('employmentType') || 'other'),
      employmentStartDate: String(formData.get('employmentStartDate') || '').trim() || null,
      employmentNote: String(formData.get('employmentNote') || '').trim() || null,
      personType: String(formData.get('personType') || 'employee'),
      includeInHeadcount:
        formData.get('includeInHeadcount') === 'on' ||
        formData.get('includeInHeadcount') === 'true',
      visibleInTeamDirectory:
        formData.get('visibleInTeamDirectory') === 'on' ||
        formData.get('visibleInTeamDirectory') === 'true',
      nationality: String(formData.get('nationality') || ''),
      identityNumber: String(formData.get('identityNumber') || ''),
      address: String(formData.get('address') || ''),
      username,
      password,
      ...(email && { email }),
    }

    if (jobTitle) userData.jobTitle = jobTitle
    if (secondaryPhone) userData.secondaryPhone = secondaryPhone
    if (secondaryEmail) userData.secondaryEmail = secondaryEmail

    const departmentId = normalizeOptionalHierarchyId(formData.get('departmentId'))
    const dottedManagerIds = readIndexedFormValues(formData, 'dottedManagers')

    // Convert role string ID if value provided
    let roleId = String(formData.get('role') || '')
    if (!roleId) {
      const memberRole = await db.query.rolesTable.findFirst({
        where: eq(rolesTable.name, 'member'),
      })
      roleId = memberRole?.id || ''
    }

    if (roleId) {
      const role = await db.query.rolesTable.findFirst({
        where: eq(rolesTable.id, roleId),
      })
      if (!role) throw new Error('Selected role does not exist')
      if (!role.isActive && role.name !== 'admin') throw new Error('Selected role is inactive')
    }

    // Handle documents upload (multi-file) via API
    const documentPaths: string[] = []
    let docIndex = 0
    while (formData.has(`documents[${docIndex}]`)) {
      const doc = formData.get(`documents[${docIndex}]`) as File | null
      if (doc && typeof doc === 'object' && 'arrayBuffer' in doc && doc.size > 0) {
        const media = await saveUploadedMedia({
          file: doc,
          category: 'employee-documents',
          allowedMimeTypes: [...imageMimeTypes, ...documentMimeTypes],
          alt: doc.name,
        })
        documentPaths.push(media.id)
      }
      docIndex++
    }

    // Employment fields
    const baseSalary = formData.get('baseSalary')
    const paymentType = String(formData.get('paymentType') || 'bankTransfer')

    // Add employment data if any employment fields are provided
    if (baseSalary || paymentType) {
      userData.employment = {
        ...(baseSalary && { baseSalary: parseFloat(String(baseSalary)) }),
        paymentType,
      }
    }

    // Hash password with bcryptjs
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 10)
    userData.password = hashedPassword

    // Set role if provided
    if (roleId) userData.roleId = roleId

    const visibleInTeamDirectory = Boolean(userData.visibleInTeamDirectory)

    await validateEmployeeHierarchyInput({
      visibleInTeamDirectory,
      departmentId,
      dottedManagerIds,
    })

    userData.departmentId = departmentId

    // Set documents if any uploaded
    if (documentPaths.length > 0) {
      userData.documents = JSON.stringify(documentPaths)
    }

    // Create user in database
    const [newUser] = await db.insert(usersTable).values(userData).returning()

    if (newUser.id) {
      await replaceDottedManagers(newUser.id, dottedManagerIds)
    }

    await writeMemberActivityLog({
      subjectUserId: newUser.id,
      actorUserId: actor.id,
      eventType: 'employee.created',
      sourceType: 'employee',
      sourceId: newUser.id,
      sourceLabel: newUser.fullName,
      sourceKey: `employee.created:${newUser.id}`,
      metadata: {
        employeeName: newUser.fullName,
        jobTitle: newUser.jobTitle,
        linkUrl: `/team-members/${newUser.id}`,
      },
    })

    await emitNotificationEvent({
      eventType: NOTIFICATION_EVENTS.employeeCreated,
      sourceType: 'employee',
      sourceId: newUser.id,
      sourceKey: `${NOTIFICATION_EVENTS.employeeCreated}:employee:${newUser.id}`,
      actorUserId: actor.id,
      recipients: toNotificationRecipients(await getUsersByIdsForNotifications([newUser.id])),
      payload: {
        employeeId: newUser.id,
        subjectUserId: newUser.id,
        employeeName: newUser.fullName,
        jobTitle: newUser.jobTitle || 'Team member',
        linkUrl: `/team-members/${newUser.id}`,
      },
    })

    // Redirect to the new staff member's profile
    await setFlashToast('success', 'User created successfully')
    redirect(`/team-members/${newUser.id}`)
  }

  return (
    <>
      <UserForm
        mode="create"
        formAction={handleCreateUser}
        departments={departments.map((dept) => ({
          value: String(dept.id),
          label: dept.name,
        }))}
        roles={roles.map((role) => ({
          value: String(role.id),
          label: role.displayName,
          name: role.name,
        }))}
        managerOptions={Array.from(
          new Map(
            managerOptions.map((manager) => [
              manager.value,
              {
                value: manager.value,
                label: manager.jobTitle ? `${manager.label} - ${manager.jobTitle}` : manager.label,
              },
            ]),
          ).values(),
        )}
      />
    </>
  )
}
