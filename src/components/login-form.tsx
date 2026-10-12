'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { normalizeLoginIdentifier } from '@/lib/usernames'

export function LoginForm({
  className,
  companyName = 'LibreStaff',
  logoUrl = '/brand/LibreStaff-Logo.png',
  ...props
}: React.ComponentProps<'div'> & {
  companyName?: string
  logoUrl?: string
}) {
  const t = useTranslations('auth')
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const normalizedIdentifier = normalizeLoginIdentifier(emailOrUsername)
      const result = await signIn('credentials', {
        email: normalizedIdentifier, // NextAuth will handle both email and username
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t('invalidCredentials'))
      } else if (result?.ok) {
        // Successful login
        router.push('/')
        router.refresh()
      }
    } catch (_err) {
      setError(t('loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex flex-col gap-2 items-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={companyName}
                width={38}
                height={38}
                className="object-contain"
              />
              <span className="text-base font-semibold">{companyName}</span>
            </div>
          </CardTitle>
          <CardDescription>
            <h2 className="font-bold text-base">{t('loginTitle')}</h2>
            <p>{t('loginDescription')}</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
              )}
              <Field>
                <FieldLabel htmlFor="emailOrUsername">{t('usernameOrEmail')}</FieldLabel>
                <Input
                  id="emailOrUsername"
                  type="text"
                  placeholder={t('usernameOrEmailPlaceholder')}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(normalizeLoginIdentifier(e.target.value))}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                  {/* <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a> */}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? t('loggingIn') : t('login')}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
