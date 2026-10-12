import type { Metadata } from 'next'
import { EmailSettingsForm } from '@/components/settings/email-settings-form'
import {
  disableEmailSettingsAction,
  enableEmailSettingsAction,
  saveEmailSettingsAction,
  sendTestEmailAction,
} from '@/lib/actions/email-settings'
import { requireAdmin } from '@/lib/auth-guards'
import { getSafeEmailSettings } from '@/lib/email-settings'

export const metadata: Metadata = {
  title: 'Email Settings',
  description: 'Manage email configuration',
}

export default async function EmailSettingsPage() {
  await requireAdmin()
  const settings = await getSafeEmailSettings()

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <EmailSettingsForm
          settings={settings}
          saveAction={saveEmailSettingsAction}
          testAction={sendTestEmailAction}
          enableAction={enableEmailSettingsAction}
          disableAction={disableEmailSettingsAction}
        />
      </div>
    </div>
  )
}
