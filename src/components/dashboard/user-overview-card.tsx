import { Users, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { UserStats } from '@/lib/actions/dashboard'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface UserOverviewCardProps {
  stats: UserStats
  className?: string
}

export function UserOverviewCard({ stats, className }: UserOverviewCardProps) {
  const t = useTranslations('dashboard')
  const activePercentage = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0

  return (
    <Card className={cn('@container/card', className)}>
      <CardHeader>
        <CardDescription>{t('totalUsers')}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {stats.total}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <UserCheck className="h-4 w-4" />
            {t('activePercent', { percent: activePercentage })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          <span className="text-green-600">{t('activeCount', { count: stats.active })}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-red-600">{t('inactiveCount', { count: stats.inactive })}</span>
        </div>
        <div className="text-muted-foreground">{t('teamOverview')}</div>
      </CardFooter>
    </Card>
  )
}
