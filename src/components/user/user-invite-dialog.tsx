'use client'

import * as React from 'react'
import { Copy, LinkIcon, MailPlus } from 'lucide-react'
import { notify } from '@/lib/notify'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'

type RoleOption = {
  value: string
  label: string
  name: string
}

type InviteResult = {
  invite: {
    email: string
    role: string
    expiresAt: string
    inviteUrl: string
    emailSent: boolean
  }
}

export function UserInviteDialog({ roles }: { roles: RoleOption[] }) {
  const t = useTranslations('users')
  const commonT = useTranslations('common')
  const memberRole = roles.find((role) => role.name === 'member') || roles[0]
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [roleId, setRoleId] = React.useState(memberRole?.value || '')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [inviteUrl, setInviteUrl] = React.useState('')
  const [emailStatus, setEmailStatus] = React.useState('')
  const selectedRoleId = roleId || memberRole?.value || ''

  const createInvite = async () => {
    setIsSubmitting(true)
    setInviteUrl('')
    setEmailStatus('')

    try {
      const response = await fetch('/api/user-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roleId: selectedRoleId }),
      })
      const body = (await response.json()) as Partial<InviteResult> & { error?: string }

      if (!response.ok || !body.invite) {
        throw new Error(body.error || t('createInviteFailed'))
      }

      setInviteUrl(body.invite.inviteUrl)
      setEmailStatus(t('inviteEmailSentTo', { email: body.invite.email }))
      notify.success(t('inviteEmailSent'))
    } catch (error) {
      notify.error(error, t('createInviteFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    notify.success(t('inviteLinkCopied'))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MailPlus className="h-4 w-4 mr-2" />
          {t('shareInvite')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inviteTeamMember')}</DialogTitle>
          <DialogDescription>
            {t('inviteDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('email')}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('role')}</Label>
            <Select value={selectedRoleId} onValueChange={setRoleId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {inviteUrl && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LinkIcon className="h-4 w-4" />
                {t('inviteLink')}
              </div>
              {emailStatus && <p className="text-xs text-muted-foreground">{emailStatus}</p>}
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyInvite}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">{t('copyInviteLink')}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {commonT('close')}
          </Button>
          <Button type="button" onClick={createInvite} disabled={isSubmitting || !email || !selectedRoleId}>
            {isSubmitting ? commonT('sending') : t('sendInvite')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
