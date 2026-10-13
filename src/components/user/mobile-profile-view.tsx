'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardClock,
  FileText,
  Languages,
  LogOut,
  MonitorCog,
  Moon,
  Package,
  Sun,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { HelpGuideButton } from '@/components/help-guide-button'
import { APP_LANGUAGE_OPTIONS, type AppLocale } from '@/i18n/config'
import type { AppTheme } from '@/lib/theme'
import { updateCurrentUserLanguage, updateCurrentUserTheme } from '@/lib/actions/user-preferences'
import { logoutAction } from '@/lib/actions/auth'
import { useTheme } from '@/components/theme-provider'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { InstallAppMenuItem } from '@/components/pwa/install-app-menu-item'

type MobileProfileSection =
  | 'leaves'
  | 'payroll'
  | 'documents'
  | 'inventory'
  | 'profile'
  | 'activity'

type MobileProfileViewProps = {
  user: {
    fullName: string
    photo?: string | null
    jobTitle?: string | null
    department?: { name: string } | null
  }
  activeSection?: MobileProfileSection
  content: Record<MobileProfileSection, React.ReactNode>
  preferences?: {
    locale: AppLocale
    theme: AppTheme
    enabledLanguages: AppLocale[]
  }
}

const sectionIcons = {
  leaves: CalendarCheck,
  payroll: WalletCards,
  documents: FileText,
  inventory: Package,
  profile: UserRound,
  activity: ClipboardClock,
} satisfies Record<MobileProfileSection, React.ComponentType<{ className?: string }>>

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function MobileProfileView({
  user,
  activeSection,
  content,
  preferences,
}: MobileProfileViewProps) {
  const profileT = useTranslations('profile')
  const authT = useTranslations('auth')
  const userMenuT = useTranslations('userMenu')
  const commonT = useTranslations('common')
  const [preferencesOpen, setPreferencesOpen] = React.useState(false)
  const [savingLanguage, setSavingLanguage] = React.useState(false)
  const [savingTheme, setSavingTheme] = React.useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const sections: Array<{
    key: MobileProfileSection
    label: string
  }> = [
    { key: 'leaves', label: profileT('leaveAndBalances') },
    { key: 'payroll', label: profileT('payroll') },
    { key: 'documents', label: profileT('documents') },
    { key: 'inventory', label: profileT('assignedEquipment') },
    { key: 'profile', label: authT('personalInformation') },
    { key: 'activity', label: profileT('activity') },
  ]

  const handleLanguage = async (locale: AppLocale) => {
    if (!preferences || locale === preferences.locale || savingLanguage) return
    try {
      setSavingLanguage(true)
      await updateCurrentUserLanguage(locale)
      notify.success(userMenuT('languageUpdated'))
      router.refresh()
    } catch (error) {
      notify.error(error, userMenuT('languageUpdateFailed'))
    } finally {
      setSavingLanguage(false)
    }
  }

  const handleTheme = async (nextTheme: AppTheme) => {
    if (nextTheme === theme || savingTheme) return
    try {
      setSavingTheme(true)
      setTheme(nextTheme)
      await updateCurrentUserTheme(nextTheme)
      notify.success(userMenuT('themeUpdated'))
    } catch (error) {
      notify.error(error, userMenuT('themeUpdateFailed'))
    } finally {
      setSavingTheme(false)
    }
  }

  const handleLogout = async () => {
    await logoutAction()
    router.replace('/login')
    router.refresh()
  }

  if (activeSection) {
    const section = sections.find((item) => item.key === activeSection)
    return (
      <div className="space-y-4 px-4 py-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link href="/me" aria-label={commonT('back')}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{section?.label}</h1>
        </div>
        {content[activeSection]}
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-5">
      <section className="overflow-hidden rounded-2xl border bg-card text-center shadow-sm">
        <div className="profile-hero-gradient relative h-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,color-mix(in_oklab,var(--background)_42%,transparent),transparent_28%),radial-gradient(circle_at_82%_24%,color-mix(in_oklab,var(--accent)_38%,transparent),transparent_24%)]" />
        </div>
        <div className="flex flex-col items-center px-4 pb-5">
          <Avatar className="-mt-12 size-24 border-4 border-card shadow-md">
            <AvatarImage src={user.photo || ''} alt={user.fullName} className="object-cover" />
            <AvatarFallback className="text-2xl">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <h1 className="mt-3 text-xl font-semibold">{user.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.jobTitle || commonT('notSpecified')}
          </p>
          <p className="text-sm text-muted-foreground">
            {user.department?.name || commonT('notSpecified')}
          </p>
        </div>
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        {sections.map((section, index) => {
          const Icon = sectionIcons[section.key]
          return (
            <Link
              key={section.key}
              href={`/me?tab=${section.key}`}
              className={cn(
                'flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-muted',
                index > 0 && 'border-t',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground/80">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{section.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          )
        })}
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
        >
          <MonitorCog className="size-5 shrink-0 text-foreground" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            {profileT('languageAndAppearance')}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <InstallAppMenuItem />
        <HelpGuideButton display="menu" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-14 w-full items-center gap-3 border-t px-4 py-3 text-left text-destructive transition-colors active:bg-muted"
        >
          <LogOut className="size-5 shrink-0" />
          <span className="flex-1 text-sm font-medium">{userMenuT('logout')}</span>
        </button>
      </Card>

      <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="text-left">
            <SheetTitle>{profileT('languageAndAppearance')}</SheetTitle>
            <SheetDescription>{profileT('languageAndAppearanceDescription')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6">
            <section>
              <h2 className="mb-2 text-sm font-semibold">{userMenuT('languages')}</h2>
              <div className="overflow-hidden rounded-xl border">
                {APP_LANGUAGE_OPTIONS.filter((option) =>
                  preferences?.enabledLanguages.includes(option.value),
                ).map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={savingLanguage}
                    onClick={() => void handleLanguage(option.value)}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm',
                      index > 0 && 'border-t',
                    )}
                  >
                    <Languages className="size-4 text-muted-foreground" />
                    <span className="flex-1">{option.nativeLabel}</span>
                    {preferences?.locale === option.value && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold">{userMenuT('theme')}</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'light' as const, label: userMenuT('light'), Icon: Sun },
                  { value: 'dark' as const, label: userMenuT('dark'), Icon: Moon },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={savingTheme}
                    onClick={() => void handleTheme(value)}
                    className={cn(
                      'flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium',
                      theme === value && 'border-primary bg-primary/5 text-primary',
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
