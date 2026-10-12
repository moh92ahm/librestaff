'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useLocale } from 'next-intl'

function formatDateTime(date: Date, locale: string) {
  return {
    date: new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date),
  }
}

type HomeClockProps = {
  className?: string
  dateClassName?: string
  timeClassName?: string
}

export function HomeClock({ className, dateClassName, timeClassName }: HomeClockProps) {
  const locale = useLocale()
  const [now, setNow] = React.useState<Date | null>(null)

  React.useEffect(() => {
    setNow(new Date())
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const formatted = now ? formatDateTime(now, locale) : null

  return (
    <div className={cn('text-right text-sm leading-tight', className)}>
      <div className={cn('font-medium text-foreground/90', dateClassName)}>
        {formatted?.date || '\u00a0'}
      </div>
      <div className={cn('font-mono text-lg font-semibold text-foreground', timeClassName)}>
        {formatted?.time || '--:--:--'}
      </div>
    </div>
  )
}
