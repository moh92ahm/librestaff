import { redirect, notFound } from 'next/navigation'
import { db } from '@/db'
import { requireAdmin } from '@/lib/auth-guards'
import { isAdmin } from '@/lib/rbac'
import { canAccessTargetUser, requirePermission } from '@/lib/permissions'
import { UserForm } from '@/components/user/forms/user-form'
import {
  AdminPasswordResetForm,
  type PasswordResetState,
} from '@/components/user/forms/admin-password-reset-form'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'
import { and, eq, asc, ne } from 'drizzle-orm'
import { usersTable, departmentsTable, rolesTable } from '@/db/schema'
import { setFlashToast } from '@/lib/flash-toast'
import { assertCanUpdateProtectedAdmin, getProtectedAdminErrorMessage } from '@/lib/protected-admin'
import {
  normalizeOptionalHierarchyId,
  readIndexedFormValues,
  replaceDottedManagers,
  validateEmployeeHierarchyInput,
} from '@/lib/employee-hierarchy'
import { normalizeUsername } from '@/lib/usernames'
import { normalizePhoneNumber } from '@/lib/phone-numbers'
import { normalizeDisplayText } from '@/lib/display-text'
import { documentMimeTypes, imageMimeTypes, saveUploadedMedia } from '@/lib/media-storage'
import { getActivityChanges, writeMemberActivityLogs } from '@/lib/member-activity'
import { getUserEditCapabilities } from '@/lib/user-edit-policy'
import { MIN_PASSWORD_LENGTH, passwordLengthError } from '@/lib/password-policy'

interface EditUserPageProps {
  params: Promise<{
    id: string
  }>
}

function dateOnly(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return null
  return text.split('T')[0]
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { id } = await params
  const currentUser = await requirePermission('employees', 'edit')
  if (!(await canAccessTargetUser(currentUser, 'employees', 'edit', id))) {
    redirect('/team-members')
  }

  try {
    // Fetch the user to edit
    const userToEdit = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
      with: {
        role: true,
        department: true,
        dottedManagers: true,
      },
    })

    if (!userToEdit) {
      notFound()
    }

    const pageCapabilities = getUserEditCapabilities({
      actorUserId: currentUser.id,
      targetUserId: id,
      actorIsAdmin: isAdmin(currentUser),
    })

    // Only load administrative choices when the current editor can use them.
    const [departments, roles, managerOptions] = await Promise.all([
      pageCapabilities.canEditAdministrativeFields
        ? db.select().from(departmentsTable).orderBy(asc(departmentsTable.name))
        : Promise.resolve([]),
      pageCapabilities.canEditRole
        ? db.select().from(rolesTable).orderBy(asc(rolesTable.name))
        : Promise.resolve([]),
      pageCapabilities.canEditAdministrativeFields
        ? db
            .select({
              value: usersTable.id,
              label: usersTable.fullName,
              jobTitle: usersTable.jobTitle,
            })
            .from(departmentsTable)
            .innerJoin(usersTable, eq(departmentsTable.managerUserId, usersTable.id))
            .where(
              and(
                eq(usersTable.isActive, true),
                eq(usersTable.visibleInTeamDirectory, true),
                ne(usersTable.id, id),
              ),
            )
            .orderBy(asc(usersTable.fullName))
        : Promise.resolve([]),
    ])

    const handleUpdateUser = async (formData: FormData) => {
      'use server'

      const actor = await requirePermission('employees', 'edit')
      if (!(await canAccessTargetUser(actor, 'employees', 'edit', id))) {
        redirect('/team-members')
      }
      const previousUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, id),
      })

      if (!previousUser) {
        redirect('/team-members')
      }

      const capabilities = getUserEditCapabilities({
        actorUserId: actor.id,
        targetUserId: id,
        actorIsAdmin: isAdmin(actor),
      })

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
      } else {
        // Keep existing photo if present
        photoPath = null
      }

      // Normalize optionals; email field must not receive empty string
      const secondaryPhone = normalizePhoneNumber(formData.get('secondaryPhone'))
      const secondaryEmail = String(formData.get('secondaryEmail') || '')

      // Update the user
      const userData: any = {
        fullName,
        ...(photoPath && { photo: photoPath }),
        birthDate: String(formData.get('birthDate') || ''),
        primaryPhone: normalizePhoneNumber(formData.get('primaryPhone')),
        nationality: String(formData.get('nationality') || ''),
        identityNumber: String(formData.get('identityNumber') || ''),
        address: String(formData.get('address') || ''),
      }

      // Optional fields
      userData.secondaryPhone = secondaryPhone || null
      userData.secondaryEmail = secondaryEmail || null

      let dottedManagerIds: string[] | null = null
      if (capabilities.canEditAdministrativeFields) {
        const email = String(formData.get('email') || '')
        const username = normalizeUsername(formData.get('username'))
        const departmentId = normalizeOptionalHierarchyId(formData.get('departmentId'))
        dottedManagerIds = readIndexedFormValues(formData, 'dottedManagers')

        Object.assign(userData, {
          jobTitle: normalizeDisplayText(formData.get('jobTitle')) || null,
          ...(email ? { email } : {}),
          ...(username ? { username } : {}),
          joinedAt: String(formData.get('joinedAt') || ''),
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
          departmentId,
        })

        await validateEmployeeHierarchyInput({
          targetUserId: id,
          visibleInTeamDirectory: Boolean(userData.visibleInTeamDirectory),
          departmentId,
          dottedManagerIds,
        })
      }

      if (capabilities.canEditRole) {
        const roleId = String(formData.get('role') || '')
        if (roleId) userData.roleId = roleId

        try {
          await assertCanUpdateProtectedAdmin({
            targetUserId: id,
            nextRoleId: roleId || undefined,
          })
        } catch (error) {
          const message = await getProtectedAdminErrorMessage(error)
          throw new Error(message || 'This user cannot be updated')
        }
      }

      // Handle documents upload (multi-file) via API
      // Get existing document paths from the current user
      const existingDocPaths = userToEdit.documents
        ? typeof userToEdit.documents === 'string'
          ? JSON.parse(userToEdit.documents)
          : userToEdit.documents
        : []

      const documentPaths: string[] = Array.isArray(existingDocPaths) ? [...existingDocPaths] : []
      let docIndex = 0
      while (formData.has(`documents[${docIndex}]`)) {
        const doc = formData.get(`documents[${docIndex}]`) as File | string
        if (doc && typeof doc === 'object' && 'arrayBuffer' in doc && doc.size > 0) {
          const media = await saveUploadedMedia({
            file: doc,
            category: 'employee-documents',
            allowedMimeTypes: [...imageMimeTypes, ...documentMimeTypes],
            alt: doc.name,
          })
          documentPaths.push(media.id)
        } else if (typeof doc === 'string' && doc) {
          // Existing document path - keep it if not already in array
          if (!documentPaths.includes(doc)) {
            documentPaths.push(doc)
          }
        }
        docIndex++
      }
      userData.documents = JSON.stringify(documentPaths)

      if (capabilities.canEditAdministrativeFields) {
        const baseSalary = formData.get('baseSalary')
        const paymentType = String(formData.get('paymentType') || 'bankTransfer')
        userData.employment = {
          ...(baseSalary && { baseSalary: parseFloat(String(baseSalary)) }),
          paymentType,
        }
      }

      const updatedAt = new Date().toISOString()

      // Update user in database
      const [updatedUser] = await db
        .update(usersTable)
        .set({
          ...userData,
          updatedAt,
        })
        .where(eq(usersTable.id, id))
        .returning()

      if (dottedManagerIds) {
        await replaceDottedManagers(id, dottedManagerIds)
      }

      const changes = updatedUser
        ? getActivityChanges(
            previousUser as any,
            updatedUser as any,
            [
              { field: 'fullName', label: 'Full name' },
              { field: 'photo', label: 'Profile photo' },
              { field: 'birthDate', label: 'Birth date', compare: dateOnly, format: dateOnly },
              { field: 'primaryPhone', label: 'Primary phone' },
              { field: 'secondaryPhone', label: 'Secondary phone' },
              { field: 'secondaryEmail', label: 'Secondary email' },
              { field: 'address', label: 'Address' },
              { field: 'email', label: 'Email' },
              { field: 'username', label: 'Username' },
              { field: 'jobTitle', label: 'Job title' },
              { field: 'joinedAt', label: 'Joined date', compare: dateOnly, format: dateOnly },
              {
                field: 'employmentStartDate',
                label: 'Official start date',
                compare: dateOnly,
                format: dateOnly,
              },
              { field: 'employmentType', label: 'Employment type' },
              { field: 'employmentNote', label: 'Employment note' },
              { field: 'personType', label: 'Person type' },
              { field: 'includeInHeadcount', label: 'Headcount inclusion' },
              { field: 'visibleInTeamDirectory', label: 'Directory visibility' },
              { field: 'nationality', label: 'Nationality' },
              { field: 'identityNumber', label: 'Identity number' },
              { field: 'roleId', label: 'Role' },
              { field: 'departmentId', label: 'Department' },
            ] as any,
          )
        : []

      if (changes.length > 0) {
        await writeMemberActivityLogs(
          changes.map((change) => ({
            subjectUserId: id,
            actorUserId: actor.id,
            eventType: 'employee.profile_field_updated',
            sourceType: 'employee',
            sourceId: id,
            sourceLabel: updatedUser?.fullName || previousUser.fullName,
            sourceKey: `employee.profile_field_updated:${id}:${change.field}:${updatedAt}`,
            metadata: {
              changes: [change],
              field: change.field,
              fieldLabel: change.label,
              oldValue: change.oldValue,
              newValue: change.newValue,
              linkUrl: `/team-members/${id}`,
            },
            createdAt: updatedAt,
          })),
        )
      }

      // Redirect back to the user profile
      await setFlashToast('success', 'User updated successfully')
      redirect(`/team-members/${id}`)
    }

    const handleUpdatePassword = async (
      _state: PasswordResetState,
      formData: FormData,
    ): Promise<PasswordResetState> => {
      'use server'

      await requireAdmin()

      const newPassword = String(formData.get('newPassword') || '')
      const confirmNewPassword = String(formData.get('confirmNewPassword') || '')

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return { error: passwordLengthError() }
      }

      if (newPassword !== confirmNewPassword) {
        return { error: 'Passwords do not match.' }
      }

      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      await db
        .update(usersTable)
        .set({
          password: hashedPassword,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(usersTable.id, id))

      return { success: 'Password updated successfully.' }
    }

    return (
      <>
        <SetBreadcrumbLabel label={userToEdit.fullName} />
        <UserForm
          mode="edit"
          initialData={userToEdit}
          headerAction={
            isAdmin(currentUser) ? <AdminPasswordResetForm action={handleUpdatePassword} /> : null
          }
          formAction={handleUpdateUser}
          canEditAdministrativeFields={pageCapabilities.canEditAdministrativeFields}
          canEditRole={pageCapabilities.canEditRole}
          departments={departments.map((dept) => ({
            value: String(dept.id),
            label: dept.name,
          }))}
          roles={roles
            .filter((role) => role.isActive || role.id === userToEdit.roleId)
            .map((role) => ({
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
                  label: manager.jobTitle
                    ? `${manager.label} - ${manager.jobTitle}`
                    : manager.label,
                },
              ]),
            ).values(),
          )}
        />
      </>
    )
  } catch (error) {
    console.error('Error fetching staff:', error)
    notFound()
  }
}
