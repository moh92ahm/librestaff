import type { Metadata } from 'next'
import { RoleForm } from '@/components/settings/role-form'

export const metadata: Metadata = {
  title: 'Create Role',
}

export default function NewRolePage() {
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
      <div className="w-full space-y-4 p-4 lg:p-6">
        <RoleForm mode="create" />
      </div>
    </div>
  )
}
