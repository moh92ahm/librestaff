import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-guards'
import { getWorkflowAdminData } from '@/lib/workflows'
import { WorkflowEditor } from '@/components/settings/workflow-settings-form'

export const metadata: Metadata = {
  title: 'Edit Workflow',
  description: 'Edit an automation workflow',
}

export default async function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const [{ id }, data] = await Promise.all([params, getWorkflowAdminData()])
  const workflow = data.workflows.find((item) => item.id === id)
  if (!workflow) notFound()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 lg:px-6">
      <div className="flex min-h-0 flex-1 overflow-hidden p-4 lg:p-6">
        <WorkflowEditor data={data} workflow={workflow} />
      </div>
    </div>
  )
}
