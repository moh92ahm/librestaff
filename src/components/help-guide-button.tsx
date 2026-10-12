'use client'

import * as React from 'react'
import { ChevronRight, CircleHelp } from 'lucide-react'
import { useMessages, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resolvePageGuideKey, type PageGuideKey } from '@/lib/page-guides'

type GuideEntry = {
  title: string
  overview: string
  parts: string[]
  actions: string[]
  notes: string[]
}

type GuidesMessages = {
  items?: Partial<Record<PageGuideKey, GuideEntry>>
}

function getGuideEntry(messages: unknown, guideKey: PageGuideKey): GuideEntry | null {
  const guides = (messages as { guides?: GuidesMessages }).guides
  const items = guides?.items
  return items?.[guideKey] || items?.fallback || null
}

function GuideSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HelpGuideButton({ display = 'icon' }: { display?: 'icon' | 'menu' }) {
  const pathname = usePathname()
  const messages = useMessages()
  const t = useTranslations('guides')
  const guideKey = resolvePageGuideKey(pathname)
  const guide = getGuideEntry(messages, guideKey)
  const [open, setOpen] = React.useState(false)

  if (!guide) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={display === 'menu' ? 'default' : 'icon'}
            aria-label={t('openGuide')}
            onClick={() => setOpen(true)}
            className={
              display === 'menu'
                ? 'h-14 w-full justify-start gap-3 rounded-none border-t px-4 font-medium'
                : undefined
            }
          >
            <CircleHelp className="h-5 w-5" />
            {display === 'menu' && (
              <>
                <span className="flex-1 text-left">{t('help')}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </>
            )}
          </Button>
        </TooltipTrigger>
        {display === 'icon' && <TooltipContent side="bottom">{t('help')}</TooltipContent>}
      </Tooltip>
      <SheetContent className="guide-sheet w-[min(92vw,28rem)] overflow-y-auto shadow-2xl sm:max-w-md">
        <SheetHeader className="guide-sheet-header border-b px-5 py-4 text-left">
          <SheetTitle className="pr-8">{guide.title}</SheetTitle>
          <SheetDescription>{t('pageGuide')}</SheetDescription>
        </SheetHeader>
        <div className="guide-sheet-body space-y-6 px-5 pb-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('overview')}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{guide.overview}</p>
          </section>
          <GuideSection title={t('mainParts')} items={guide.parts} />
          <GuideSection title={t('commonActions')} items={guide.actions} />
          <GuideSection title={t('notes')} items={guide.notes} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
