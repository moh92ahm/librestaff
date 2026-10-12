'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { CheckCircle2, Plug, Power, Save, Send, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SafeEmailSettings } from '@/lib/email-settings'
import type { EmailActionState } from '@/lib/actions/email-settings'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

const initialState: EmailActionState = { status: 'idle', message: '' }

type EmailSettingsFormProps = {
  settings: SafeEmailSettings
  saveAction: (
    previousState: EmailActionState,
    formData: FormData,
  ) => Promise<EmailActionState>
  testAction: (
    previousState: EmailActionState,
    formData: FormData,
  ) => Promise<EmailActionState>
  enableAction: (
    previousState?: EmailActionState,
    formData?: FormData,
  ) => Promise<EmailActionState>
  disableAction: (
    previousState?: EmailActionState,
    formData?: FormData,
  ) => Promise<EmailActionState>
}

function ActionMessage({ state }: { state: EmailActionState }) {
  if (!state.message) return null

  return (
    <p
      className={
        state.status === 'error'
          ? 'text-sm text-destructive'
          : 'text-sm text-muted-foreground'
      }
    >
      {state.message}
    </p>
  )
}

function SubmitButton({
  children,
  icon,
  pendingText,
  disabled,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  pendingText: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabled}>
      {icon}
      {pending ? pendingText : children}
    </Button>
  )
}

export function EmailSettingsForm({
  settings,
  saveAction,
  testAction,
  enableAction,
  disableAction,
}: EmailSettingsFormProps) {
  const t = useTranslations('settings')
  const commonT = useTranslations('common')
  const [saveState, saveFormAction] = useActionState(saveAction, initialState)
  const [testState, testFormAction] = useActionState(testAction, initialState)
  const [enableState, enableFormAction] = useActionState(enableAction, initialState)
  const [disableState, disableFormAction] = useActionState(disableAction, initialState)
  const shownMessages = React.useRef(new Set<string>())
  const canEnable = settings.lastTestStatus === 'success'

  React.useEffect(() => {
    for (const state of [saveState, testState, enableState, disableState]) {
      if (!state.message || state.status === 'idle') continue
      const key = `${state.status}:${state.message}`
      if (shownMessages.current.has(key)) continue
      shownMessages.current.add(key)
      if (state.status === 'success') notify.success(state.message)
      if (state.status === 'error') notify.error(state.message)
    }
  }, [disableState, enableState, saveState, testState])

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t('emailTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('emailDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t('deliveryStatus')}</CardTitle>
              <CardDescription>{t('deliveryDescription')}</CardDescription>
            </div>
            <Badge variant={settings.enabled ? 'success' : 'secondary'}>
              {settings.enabled ? commonT('enabled') : commonT('disabled')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{t('encryptionKey')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings.encryptionConfigured ? t('configured') : commonT('missing')}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{t('lastTest')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings.lastTestAt
                ? new Date(settings.lastTestAt).toLocaleString()
                : t('noTestSent')}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{t('testStatus')}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {settings.lastTestStatus === 'success' ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : settings.lastTestStatus === 'failed' ? (
                <XCircle className="size-4 text-destructive" />
              ) : (
                <Plug className="size-4" />
              )}
              {settings.lastTestStatus || commonT('notTested')}
            </p>
          </div>
          {settings.lastTestError && (
            <p className="md:col-span-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {settings.lastTestError}
            </p>
          )}
        </CardContent>
      </Card>

      <form action={saveFormAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('smtpSettings')}</CardTitle>
            <CardDescription>{t('smtpDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fromName">{t('fromName')}</Label>
              <Input id="fromName" name="fromName" defaultValue={settings.fromName} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fromEmail">{t('fromEmail')}</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={settings.fromEmail}
                placeholder="no-reply@example.com"
                required
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="replyToEmail">{t('replyToEmail')}</Label>
              <Input
                id="replyToEmail"
                name="replyToEmail"
                type="email"
                defaultValue={settings.replyToEmail || ''}
                placeholder={commonT('optional')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtpHost">{t('smtpHost')}</Label>
              <Input
                id="smtpHost"
                name="smtpHost"
                defaultValue={settings.smtpHost}
                placeholder="smtp-relay.gmail.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtpPort">{t('smtpPort')}</Label>
              <Input
                id="smtpPort"
                name="smtpPort"
                type="number"
                min={1}
                max={65535}
                defaultValue={settings.smtpPort}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="secureMode">{t('tlsMode')}</Label>
              <Select name="secureMode" defaultValue={settings.secureMode}>
                <SelectTrigger id="secureMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS</SelectItem>
                  <SelectItem value="ssl">SSL / TLS</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="authMode">{t('authentication')}</Label>
              <Select name="authMode" defaultValue={settings.authMode}>
                <SelectTrigger id="authMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noAuthentication')}</SelectItem>
                  <SelectItem value="login">{t('usernamePassword')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtpUsername">{t('smtpUsername')}</Label>
              <Input
                id="smtpUsername"
                name="smtpUsername"
                autoComplete="off"
                placeholder={settings.hasSmtpUsername ? t('savedLeaveBlank') : commonT('optional')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smtpPassword">{t('smtpPassword')}</Label>
              <Input
                id="smtpPassword"
                name="smtpPassword"
                type="password"
                autoComplete="new-password"
                placeholder={settings.hasSmtpPassword ? t('savedLeaveBlank') : commonT('optional')}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <div className="space-y-2 text-right">
                <SubmitButton
                  icon={<Save className="mr-2 size-4" />}
                  pendingText={commonT('saving')}
                >
                  {commonT('save')}
                </SubmitButton>
                <ActionMessage state={saveState} />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{t('testAndEnable')}</CardTitle>
          <CardDescription>
            {t('testDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={testFormAction} className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor="testEmail">{t('testRecipient')}</Label>
              <Input
                id="testEmail"
                name="testEmail"
                type="email"
                defaultValue={settings.fromEmail}
                required
              />
            </div>
            <div className="flex items-end">
              <SubmitButton icon={<Send className="mr-2 size-4" />} pendingText={commonT('sending')}>
                {t('sendTestEmail')}
              </SubmitButton>
            </div>
            <div className="md:col-span-2">
              <ActionMessage state={testState} />
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <form action={enableFormAction}>
              <SubmitButton
                icon={<Power className="mr-2 size-4" />}
                pendingText={`${commonT('loading')}...`}
                disabled={!canEnable || settings.enabled}
              >
                {t('enableEmailSending')}
              </SubmitButton>
            </form>
            <form action={disableFormAction}>
              <Button type="submit" variant="outline" disabled={!settings.enabled}>
                {t('disable')}
              </Button>
            </form>
          </div>
          <ActionMessage state={enableState} />
          <ActionMessage state={disableState} />
        </CardContent>
      </Card>
    </div>
  )
}
