import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth-guards'
import { getWorkflowAdminData } from '@/lib/workflows'
import { WorkflowEditor } from '@/components/settings/workflow-settings-form'

export const metadata: Metadata = {
  title: 'New Workflow',
  description: 'Create an automation workflow',
}

export default async function NewWorkflowPage() {
  await requireAdmin()
  const data = await getWorkflowAdminData()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 lg:px-6">
      <div className="flex min-h-0 flex-1 overflow-hidden p-4 lg:p-6">
        <WorkflowEditor data={data} />
      </div>
    </div>
  )
}
