'use client'

import * as React from 'react'
import { Check, ChevronRight, Download, Share, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { usePwaInstall } from '@/components/pwa/pwa-install-provider'

export function InstallAppMenuItem() {
  const t = useTranslations('profile.installApp')
  const { mode, promptInstall } = usePwaInstall()
  const [instructionsOpen, setInstructionsOpen] = React.useState(false)

  const handleClick = async () => {
    if (mode === 'installed' || mode === 'checking' || mode === 'unavailable') return
    if (mode === 'installable') {
      await promptInstall()
      return
    }
    setInstructionsOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={mode === 'checking' || mode === 'unavailable'}
        className="flex min-h-14 w-full items-center gap-3 border-t px-4 py-3 text-left transition-colors active:bg-muted disabled:opacity-60"
      >
        {mode === 'installed' ? (
          <Check className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Download className="size-5 shrink-0 text-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {mode === 'installed' ? t('installed') : t('title')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {mode === 'installed' ? t('installedDescription') : t('description')}
          </span>
        </span>
        {mode !== 'installed' && mode !== 'checking' && mode !== 'unavailable' && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <Sheet open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="text-left">
            <SheetTitle>{t('instructionsTitle')}</SheetTitle>
            <SheetDescription>
              {mode === 'ios' ? t('iosDescription') : t('manualDescription')}
            </SheetDescription>
          </SheetHeader>
          <ol className="space-y-3 px-4 pb-6">
            {(mode === 'ios'
              ? [
                  { icon: Share, text: t('iosStepShare') },
                  { icon: Smartphone, text: t('iosStepHomeScreen') },
                  { icon: Check, text: t('iosStepAdd') },
                ]
              : [
                  { icon: Smartphone, text: t('manualStepMenu') },
                  { icon: Download, text: t('manualStepInstall') },
                ]
            ).map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
    </>
  )
}
