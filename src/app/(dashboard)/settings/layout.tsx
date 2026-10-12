import { requireAdmin } from '@/lib/auth-guards'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:flex-row">
      <SettingsSidebar />
      <section className="flex min-w-0 flex-1 overflow-hidden">{children}</section>
    </div>
  )
}
