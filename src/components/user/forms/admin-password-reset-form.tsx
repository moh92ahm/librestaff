'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

export interface PasswordResetState {
  success?: string
  error?: string
}

interface AdminPasswordResetFormProps {
  action: (state: PasswordResetState, formData: FormData) => Promise<PasswordResetState>
}

const initialState: PasswordResetState = {}

export function AdminPasswordResetForm({ action }: AdminPasswordResetFormProps) {
  const t = useTranslations('users')
  const common = useTranslations('common')
  const formRef = React.useRef<HTMLFormElement>(null)
  const [open, setOpen] = React.useState(false)
  const [state, formAction, pending] = useActionState(action, initialState)

  React.useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setOpen(false)
      notify.success(state.success)
    }

    if (state.error) {
      notify.error(state.error)
    }
  }, [state.error, state.success])

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <KeyRound className="h-4 w-4 mr-2" />
            {t('setNewPassword')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('setNewPassword')}</DialogTitle>
            <DialogDescription>{t('adminPasswordDescription')}</DialogDescription>
          </DialogHeader>

          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('newPassword')}</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">{t('confirmPassword')}</Label>
              <Input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('updating') : t('updatePassword')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
    </div>
  )
}
