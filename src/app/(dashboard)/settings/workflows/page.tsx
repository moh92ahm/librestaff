import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth-guards'
import { getWorkflowAdminData } from '@/lib/workflows'
import { WorkflowSettingsForm } from '@/components/settings/workflow-settings-form'

export const metadata: Metadata = {
  title: 'Workflow Settings',
  description: 'Manage automation workflows',
}

export default async function WorkflowSettingsPage() {
  await requireAdmin()
  const data = await getWorkflowAdminData()

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <WorkflowSettingsForm data={data} />
      </div>
    </div>
  )
}
