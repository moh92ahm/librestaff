'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InputField } from '@/components/form/input-field'
import { BirthdatePicker } from '@/components/date-pickers/birthdate-picker'
import { JoinedDatePicker } from '@/components/date-pickers/joined-date-picker'
import { Spinner } from '@/components/ui/spinner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { notify } from '@/lib/notify'
import { useRouter } from 'next/navigation'
import { SelectField } from '@/components/form/select-field'
import { useTranslations } from 'next-intl'
import { getNationalityOptions } from '@/lib/nationalities'
import { normalizeUsername } from '@/lib/usernames'
import { normalizePhoneNumber } from '@/lib/phone-numbers'
import { normalizeDisplayTextInput } from '@/lib/display-text'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

type ValidationKey =
  | 'fullNameRequired'
  | 'invalidEmail'
  | 'usernameMin'
  | 'passwordMin'
  | 'phoneRequired'
  | 'birthDateRequired'
  | 'joinedDateRequired'
  | 'passwordsDoNotMatch'

function createSignupSchema(t: (key: ValidationKey) => string) {
  return z
    .object({
      fullName: z.string().min(1, t('fullNameRequired')),
      email: z.string().email(t('invalidEmail')),
      username: z.string().min(3, t('usernameMin')),
      password: z.string().min(MIN_PASSWORD_LENGTH, t('passwordMin')),
      confirmPassword: z.string(),
      primaryPhone: z.string().min(1, t('phoneRequired')),
      birthDate: z.string().min(1, t('birthDateRequired')),
      joinedAt: z.string().min(1, t('joinedDateRequired')),
      nationality: z.string().optional(),
      identityNumber: z.string().optional(),
      address: z.string().optional(),
      setupSecret: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    })
}

type SignupFormValues = z.infer<ReturnType<typeof createSignupSchema>>

interface UserSignupFormProps {
  initialEmail?: string
  inviteToken?: string
  emailReadOnly?: boolean
  setupMode?: boolean
}

export function UserSignupForm({
  initialEmail = '',
  inviteToken,
  emailReadOnly,
  setupMode = false,
}: UserSignupFormProps) {
  const t = useTranslations('auth')
  const validationT = useTranslations('validation')
  const nationalityT = useTranslations('nationalities')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const signupSchema = React.useMemo(() => createSignupSchema(validationT), [validationT])
  const nationalityOptions = React.useMemo(
    () => getNationalityOptions((value) => nationalityT(value)),
    [nationalityT],
  )

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: initialEmail,
      username: '',
      password: '',
      confirmPassword: '',
      primaryPhone: '',
      birthDate: '',
      joinedAt: '',
      nationality: '',
      identityNumber: '',
      address: '',
      setupSecret: '',
    },
  })

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ...(inviteToken && { inviteToken }),
          ...(!setupMode && { setupSecret: undefined }),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || t('createAccountFailed'))
      }

      notify.success(t('accountCreated'))
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      console.error('Signup error:', error)
      notify.error(error, t('createAccountFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-medium">{t('personalInformation')}</h3>

          <InputField
            label={`${t('fullName')} *`}
            name="fullName"
            register={register}
            error={errors.fullName?.message}
            transformValue={normalizeDisplayTextInput}
          />

          <InputField
            label={`${t('email')} *`}
            name="email"
            type="email"
            register={register}
            error={errors.email?.message}
            inputProps={{
              readOnly: emailReadOnly,
              'aria-readonly': emailReadOnly || undefined,
            }}
          />

          <InputField
            label={`${t('primaryPhone')} *`}
            name="primaryPhone"
            type="tel"
            register={register}
            error={errors.primaryPhone?.message}
            transformValue={normalizePhoneNumber}
          />

          <Controller
            name="birthDate"
            control={control}
            render={({ field }) => (
              <BirthdatePicker
                label={`${t('birthDate')} *`}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.birthDate?.message}
              />
            )}
          />

          <Controller
            name="joinedAt"
            control={control}
            render={({ field }) => (
              <JoinedDatePicker
                label={`${t('joinedDate')} *`}
                value={field.value}
                onValueChange={field.onChange}
                error={errors.joinedAt?.message}
              />
            )}
          />
        </CardContent>
      </Card>

      {/* Account Credentials */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-medium">{t('accountCredentials')}</h3>

          <InputField
            label={`${t('username')} *`}
            name="username"
            register={register}
            error={errors.username?.message}
            transformValue={normalizeUsername}
          />

          <InputField
            label={`${t('password')} *`}
            name="password"
            type="password"
            register={register}
            error={errors.password?.message}
          />

          <InputField
            label={`${t('confirmPassword')} *`}
            name="confirmPassword"
            type="password"
            register={register}
            error={errors.confirmPassword?.message}
          />

          {setupMode ? (
            <InputField
              label={`${t('setupSecret')} *`}
              name="setupSecret"
              type="password"
              register={register}
              error={errors.setupSecret?.message}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Employment Information */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-medium">{t('additionalInformation')}</h3>

          <SelectField
            control={control}
            name={'nationality'}
            label={t('nationality')}
            placeholder={t('selectNationality')}
            options={nationalityOptions}
            searchable={true}
          />

          <InputField label={t('identityNumber')} name="identityNumber" register={register} />

          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              {t('address')}
            </label>
            <textarea
              id="address"
              {...register('address')}
              className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('addressPlaceholder')}
            />
            {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              {t('creatingAccount')}
            </>
          ) : (
            t('createAccount')
          )}
        </Button>
      </div>

      {/* Login Link */}
      <div className="text-center text-sm text-gray-600">
        {t('alreadyHaveAccount')}{' '}
        <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
          {t('loginHere')}
        </a>
      </div>
    </form>
  )
}
