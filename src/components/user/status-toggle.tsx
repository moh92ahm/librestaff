'use client'

import * as React from 'react'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

type User = InferSelectModel<typeof usersTable>

interface UserStatusToggleProps {
  user: User
  onStatusChange?: (isActive: boolean) => Promise<void>
}

export function UserStatusToggle({ user, onStatusChange }: UserStatusToggleProps) {
  const t = useTranslations('users')
  const [isActive, setIsActive] = React.useState<boolean>(Boolean(user.isActive))
  const [isLoading, setIsLoading] = React.useState(false)

  const handleToggle = async (checked: boolean) => {
    if (!onStatusChange) return

    setIsLoading(true)
    try {
      await onStatusChange(checked)
      setIsActive(checked)
      notify.success(checked ? t('userActivated') : t('userDeactivated'))
    } catch (error) {
      console.error('Failed to update user status:', error)
      notify.error(error, t('statusUpdateFailed'))
      // Revert the visual state if the update failed
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Switch
            checked={isActive}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            aria-label="Toggle user active status"
          />
        </div>
      </div>
    </div>
  )
}
