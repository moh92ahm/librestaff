'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePhotoUpload } from '@/components/ui/profile-photo-upload'
import { ArrowLeft, Save, X } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable> & {
  role?: { id: string; name: string } | null
  departmentId?: string | null
  department?: {
    id: string
    name: string
    isActive: boolean
    createdAt: string | null
    updatedAt: string | null
    description: string | null
  } | null
  dottedManagers?: Array<{
    id: string
    userId: string
    managerId: string
    createdAt: string | null
  }>
}

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserFormSchema, type UserFormValues } from './user-form.schema'
import { SelectField } from '@/components/form/select-field'
import { ComboboxMultiSelect } from '@/components/form/combobox-multi-select'
import { Spinner } from '@/components/ui/spinner'
import { BirthdatePicker } from '@/components/date-pickers/birthdate-picker'
import { JoinedDatePicker } from '@/components/date-pickers/joined-date-picker'
import { OfficialStartDatePicker } from '@/components/date-pickers/official-start-date-picker'
import { PERSON_TYPES } from '@/lib/people'
import { getNationalityOptions } from '@/lib/nationalities'
import { notify } from '@/lib/notify'
import { normalizeUsername } from '@/lib/usernames'
import { normalizePhoneNumber } from '@/lib/phone-numbers'
import { normalizeDisplayText, normalizeDisplayTextInput } from '@/lib/display-text'
import { useTranslations } from 'next-intl'

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  )
}

function EditRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-500">{message}</p>
}

interface UserFormProps {
  initialData?: Partial<User>
  onSubmit?: (data: UserFormValues) => Promise<any>
  formAction?: (formData: FormData) => Promise<void>
  headerAction?: React.ReactNode
  mode: 'create' | 'edit'
  isSubmitting?: boolean
  departments?: Array<{ value: string; label: string }>
  roles?: Array<{ value: string; label: string; name?: string }>
  managerOptions?: Array<{ value: string; label: string }>
  canEditAdministrativeFields?: boolean
  canEditRole?: boolean
}

export function UserForm({
  initialData,
  formAction,
  headerAction,
  mode,
  isSubmitting = false,
  departments = [],
  roles = [],
  managerOptions = [],
  canEditAdministrativeFields = true,
  canEditRole = true,
}: UserFormProps) {
  const t = useTranslations('users')
  const common = useTranslations('common')
  const profileT = useTranslations('profile')
  const enumT = useTranslations('enums')
  const roleT = useTranslations('users.roles')
  const personTypeT = useTranslations('users.personTypes')
  const nationalityT = useTranslations('nationalities')
  const fallbackJoinedAt =
    initialData?.joinedAt?.split('T')[0] ||
    (mode === 'create' ? new Date().toISOString().split('T')[0] : undefined)
  const initialEmploymentStartDate = initialData?.employmentStartDate?.split('T')[0]
  const defaultValues: UserFormValues = {
    fullName: normalizeDisplayText(initialData?.fullName || ''),
    username: normalizeUsername(initialData?.username || ''),
    email: initialData?.email || '',
    password: mode === 'create' ? '' : undefined,
    confirmPassword: mode === 'create' ? '' : undefined,
    photo: initialData?.photo || null,
    departmentId: initialData?.departmentId || '',
    dottedManagers: Array.isArray(initialData?.dottedManagers)
      ? initialData.dottedManagers.map((manager) => manager.managerId)
      : [],
    role: initialData?.roleId || initialData?.role?.id || undefined,
    personType: initialData?.personType || 'employee',
    includeInHeadcount: initialData?.includeInHeadcount ?? true,
    visibleInTeamDirectory: initialData?.visibleInTeamDirectory ?? true,
    jobTitle: normalizeDisplayText(initialData?.jobTitle || ''),
    birthDate: initialData?.birthDate?.split('T')[0] || '', // Extract YYYY-MM-DD from ISO
    primaryPhone: initialData?.primaryPhone || '',
    secondaryPhone: initialData?.secondaryPhone || '',
    secondaryEmail: initialData?.secondaryEmail || '',
    employmentType: initialData?.employmentType || 'other',
    nationality: initialData?.nationality || '',
    identityNumber: initialData?.identityNumber || '',
    employmentNote: initialData?.employmentNote || '',
    employmentStartDate: initialEmploymentStartDate || fallbackJoinedAt,
    address: initialData?.address || '',
    documents: Array.isArray(initialData?.documents)
      ? initialData.documents.map((doc) => {
          // Keep the full document object if available, otherwise just the ID
          if (typeof doc === 'object' && doc && 'id' in doc) {
            return doc // Return the full media object
          }
          return String(doc) // Fallback to string ID
        })
      : [],
    isActive: initialData?.isActive ?? true,
    joinedAt: fallbackJoinedAt,
  }

  const {
    register,
    control,
    // handleSubmit,
    getValues,
    setValue,
    trigger,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(UserFormSchema) as any,
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const dottedManagerOptions = managerOptions
  const roleLabels = roleT.raw('labels') as Record<string, string>
  const localizedRoles = roles.map((role) => ({
    ...role,
    label: role.name && role.name in roleLabels ? roleT(`labels.${role.name}`) : role.label,
  }))
  const personTypeOptions = PERSON_TYPES.map((personType) => ({
    value: personType,
    label: personTypeT(personType),
  }))
  const nationalityOptions = React.useMemo(
    () => getNationalityOptions((value) => nationalityT(value), initialData?.nationality),
    [nationalityT, initialData?.nationality],
  )

  // const onValidSubmit: SubmitHandler<UserFormValues> = React.useCallback(
  //   async (values) => {
  //     if (!onSubmit) return
  //     try {
  //       await onSubmit(values)
  //     } catch (error) {
  //       console.error('Form submission error:', error)
  //     }
  //   },
  //   [onSubmit],
  // )

  const formRef = React.useRef<HTMLFormElement>(null)
  const [nativeSubmitting, setNativeSubmitting] = React.useState(false)
  const [validationPassed, setValidationPassed] = React.useState(false)
  const [employmentStartFollowsJoinedAt, setEmploymentStartFollowsJoinedAt] = React.useState(
    !initialEmploymentStartDate || initialEmploymentStartDate === fallbackJoinedAt,
  )
  const isCreate = mode === 'create'
  const backHref = isCreate ? '/team-members' : `/team-members/${initialData?.id}`
  const pageTitle = isCreate ? t('addNewUser') : t('editUserProfile')
  const pageDescription = isCreate ? undefined : t('editProfileDescription')
  const isPending = isSubmitting || isFormSubmitting || nativeSubmitting
  const fullNameField = register('fullName')
  const jobTitleField = register('jobTitle')
  const usernameField = register('username')
  const primaryPhoneField = register('primaryPhone')
  const secondaryPhoneField = register('secondaryPhone')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!formAction) return

    if (!validationPassed) {
      event.preventDefault()

      const ok = await trigger()
      if (!ok) return

      if (isCreate) {
        const password = getValues('password') || ''
        const confirmPassword = getValues('confirmPassword') || ''

        if (!password) {
          notify.warning(t('passwordRequired'))
          return
        }
        if (!confirmPassword) {
          notify.warning(t('confirmPasswordRequired'))
          return
        }
        if (password !== confirmPassword) {
          notify.error(t('passwordsDoNotMatch'))
          return
        }
      }

      setValidationPassed(true)
      setNativeSubmitting(true)

      setTimeout(() => {
        formRef.current?.requestSubmit()
      }, 0)
      return
    }

    setNativeSubmitting(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href={backHref}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {common('back')}
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">{pageTitle}</h1>
              {pageDescription ? (
                <p className="text-sm text-muted-foreground">{pageDescription}</p>
              ) : null}
            </div>
          </div>
          {headerAction}
        </div>

        <form
          ref={formRef}
          action={formAction as any}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <input type="hidden" name="isActive" value={String(defaultValues.isActive)} />

          <EditSection title={t('editSections.profile')}>
            <EditRow title={t('profilePhoto')} description={t('editHelp.photo')}>
              <Controller
                control={control}
                name="photo"
                render={({ field: { value, onChange } }) => (
                  <ProfilePhotoUpload
                    value={value ?? null}
                    onChange={(file) => onChange(file)}
                    name="photo"
                    placeholder={t('profilePhoto')}
                    size="xl"
                    className="items-start"
                  />
                )}
              />
            </EditRow>

            <EditRow title={t('fullName')} description={t('editHelp.fullName')}>
              <Input
                id="fullName"
                className={errors.fullName ? 'border-red-500' : ''}
                {...fullNameField}
                onChange={(event) => {
                  event.target.value = normalizeDisplayTextInput(event.target.value)
                  fullNameField.onChange(event)
                }}
              />
              <FieldError message={errors.fullName?.message as string | undefined} />
            </EditRow>

            {canEditAdministrativeFields ? (
              <EditRow title={t('jobTitle')} description={t('editHelp.jobTitle')}>
                <Input
                  id="jobTitle"
                  {...jobTitleField}
                  onChange={(event) => {
                    event.target.value = normalizeDisplayTextInput(event.target.value)
                    jobTitleField.onChange(event)
                  }}
                />
              </EditRow>
            ) : null}

            {canEditAdministrativeFields ? (
              <EditRow title={t('email')} description={t('editHelp.email')}>
                <Input
                  id="email"
                  type="email"
                  className={errors.email ? 'border-red-500' : ''}
                  {...register('email')}
                />
                <FieldError message={errors.email?.message as string | undefined} />
              </EditRow>
            ) : null}

            {canEditAdministrativeFields ? (
              <EditRow title={t('username')} description={t('editHelp.username')}>
                <Input
                  id="username"
                  className={errors.username ? 'border-red-500' : ''}
                  {...usernameField}
                  onChange={(event) => {
                    event.target.value = normalizeUsername(event.target.value)
                    usernameField.onChange(event)
                  }}
                />
                <FieldError message={errors.username?.message as string | undefined} />
              </EditRow>
            ) : null}

            {isCreate ? (
              <>
                <EditRow title={t('password')} description={t('editHelp.password')}>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className={errors.password ? 'border-red-500' : ''}
                    {...register('password')}
                  />
                  <FieldError message={errors.password?.message as string | undefined} />
                </EditRow>

                <EditRow title={t('confirmPassword')} description={t('editHelp.confirmPassword')}>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                    {...register('confirmPassword')}
                  />
                  <FieldError message={errors.confirmPassword?.message as string | undefined} />
                </EditRow>
              </>
            ) : null}
          </EditSection>

          {canEditAdministrativeFields ? (
            <EditSection title={t('editSections.organization')}>
              <EditRow title={t('department')} description={t('editHelp.department')}>
                <SelectField
                  control={control}
                  name={'departmentId'}
                  placeholder={t('selectDepartment')}
                  options={departments}
                  error={errors.departmentId?.message as string | undefined}
                />
              </EditRow>

              <EditRow
                title={t('dottedLineManagers')}
                description={t('editHelp.dottedLineManagers')}
              >
                <ComboboxMultiSelect
                  control={control}
                  name={'dottedManagers'}
                  placeholder={t('selectDottedLineManagers')}
                  searchPlaceholder={t('searchManagers')}
                  emptyMessage={t('noManagersFound')}
                  options={dottedManagerOptions}
                  error={errors.dottedManagers?.message as string | undefined}
                />
              </EditRow>

              {canEditRole ? (
                <EditRow title={t('role')} description={t('editHelp.role')}>
                  <SelectField
                    control={control}
                    name={'role'}
                    placeholder={t('selectRole')}
                    options={localizedRoles}
                    error={errors.role?.message as string | undefined}
                  />
                </EditRow>
              ) : null}

              <EditRow title={t('personType')} description={t('editHelp.personType')}>
                <SelectField
                  control={control}
                  name={'personType'}
                  placeholder={t('selectPersonType')}
                  options={personTypeOptions}
                  error={errors.personType?.message as string | undefined}
                />
              </EditRow>

              <EditRow
                title={t('directoryAndHeadcount')}
                description={t('editHelp.directoryAndHeadcount')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      {...register('visibleInTeamDirectory')}
                    />
                    {t('visibleInTeamMembers')}
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      {...register('includeInHeadcount')}
                    />
                    {t('includeInHeadcount')}
                  </label>
                </div>
              </EditRow>
            </EditSection>
          ) : null}

          <EditSection title={t('editSections.dates')}>
            <EditRow title={t('birthDate')} description={t('editHelp.birthDate')}>
              <Controller
                control={control}
                name="birthDate"
                render={({ field }) => (
                  <BirthdatePicker
                    label={t('birthDate')}
                    value={field.value}
                    onValueChange={field.onChange}
                    name="birthDate"
                    error={errors.birthDate?.message as string | undefined}
                  />
                )}
              />
            </EditRow>

            {canEditAdministrativeFields ? (
              <EditRow title={t('joinedAtDate')} description={t('editHelp.joinedAt')}>
                <Controller
                  control={control}
                  name="joinedAt"
                  render={({ field }) => (
                    <JoinedDatePicker
                      label={t('joinedAtDate')}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (employmentStartFollowsJoinedAt) {
                          setValue('employmentStartDate', value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      }}
                      name="joinedAt"
                    />
                  )}
                />
              </EditRow>
            ) : null}
          </EditSection>

          <EditSection title={profileT('employmentStatus')}>
            <EditRow title={t('nationality')} description={t('editHelp.nationality')}>
              <SelectField
                control={control}
                name={'nationality'}
                placeholder={t('selectNationality')}
                options={nationalityOptions}
                searchable={true}
              />
            </EditRow>

            <EditRow title={t('identityNumber')} description={t('editHelp.identityNumber')}>
              <Input id="identityNumber" {...register('identityNumber')} />
            </EditRow>

            {canEditAdministrativeFields ? (
              <EditRow title={t('employmentType')} description={t('editHelp.employmentType')}>
                <SelectField
                  control={control}
                  name={'employmentType'}
                  placeholder={t('selectEmploymentType')}
                  options={[
                    { label: enumT('employmentType.citizen'), value: 'citizen' },
                    { label: enumT('employmentType.workPermit'), value: 'workPermit' },
                    { label: enumT('employmentType.other'), value: 'other' },
                  ]}
                />
              </EditRow>
            ) : null}

            {canEditAdministrativeFields ? (
              <EditRow
                title={profileT('officialStartDate')}
                description={t('editHelp.officialStartDate')}
              >
                <Controller
                  control={control}
                  name="employmentStartDate"
                  render={({ field }) => (
                    <OfficialStartDatePicker
                      label={profileT('officialStartDate')}
                      value={field.value}
                      onValueChange={(value) => {
                        setEmploymentStartFollowsJoinedAt(false)
                        field.onChange(value)
                      }}
                      name="employmentStartDate"
                      error={errors.employmentStartDate?.message as string | undefined}
                    />
                  )}
                />
              </EditRow>
            ) : null}

            {canEditAdministrativeFields ? (
              <EditRow title={t('employmentNote')} description={t('editHelp.employmentNote')}>
                <Textarea id="employmentNote" rows={4} {...register('employmentNote')} />
              </EditRow>
            ) : null}
          </EditSection>

          <EditSection title={profileT('contactInformation')}>
            <EditRow title={profileT('primaryPhone')} description={t('editHelp.primaryPhone')}>
              <Input
                id="primaryPhone"
                type="tel"
                className={errors.primaryPhone ? 'border-red-500' : ''}
                {...primaryPhoneField}
                onChange={(event) => {
                  event.target.value = normalizePhoneNumber(event.target.value)
                  primaryPhoneField.onChange(event)
                }}
              />
              <FieldError message={errors.primaryPhone?.message as string | undefined} />
            </EditRow>

            <EditRow title={profileT('secondaryPhone')} description={t('editHelp.secondaryPhone')}>
              <Input
                id="secondaryPhone"
                type="tel"
                {...secondaryPhoneField}
                onChange={(event) => {
                  event.target.value = normalizePhoneNumber(event.target.value)
                  secondaryPhoneField.onChange(event)
                }}
              />
            </EditRow>

            <EditRow title={profileT('secondaryEmail')} description={t('editHelp.secondaryEmail')}>
              <Input
                id="secondaryEmail"
                type="email"
                className={errors.secondaryEmail ? 'border-red-500' : ''}
                {...register('secondaryEmail')}
              />
              <FieldError message={errors.secondaryEmail?.message as string | undefined} />
            </EditRow>

            <EditRow title={profileT('address')} description={t('editHelp.address')}>
              <Textarea id="address" rows={4} {...register('address')} />
            </EditRow>
          </EditSection>

          <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
            <div className="mx-auto flex max-w-6xl justify-end gap-3">
              <Link href={backHref}>
                <Button type="button" variant="outline" className="cursor-pointer">
                  <X className="h-4 w-4 mr-2" />
                  {common('cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isPending}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isPending
                  ? isCreate
                    ? t('creating')
                    : common('saving')
                  : isCreate
                    ? t('createUser')
                    : t('saveChanges')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
