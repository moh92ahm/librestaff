'use client'

import * as React from 'react'
import { IconDotsVertical } from '@tabler/icons-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

import { logoutAction } from '@/lib/actions/auth'
import { useSession } from 'next-auth/react'
import { Check, Languages, LogOut, Moon, Sun, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { useTranslations } from 'next-intl'
import {
  APP_LANGUAGE_OPTIONS,
  DEFAULT_LOCALE,
  normalizeLocale,
  type AppLocale,
} from '@/i18n/config'
import { updateCurrentUserLanguage, updateCurrentUserTheme } from '@/lib/actions/user-preferences'
import type { AppTheme } from '@/lib/theme'
import { notify } from '@/lib/notify'

type NavUserProps = {
  enabledLanguages?: string[]
  currentLanguage?: AppLocale
  currentTheme?: AppTheme
}

export function NavUser({
  enabledLanguages = [DEFAULT_LOCALE],
  currentLanguage = DEFAULT_LOCALE,
  currentTheme = 'light',
}: NavUserProps) {
  const { data: session, status } = useSession()
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { setTheme } = useTheme()
  const t = useTranslations('userMenu')
  const [savingLanguage, setSavingLanguage] = React.useState<string | null>(null)
  const [savingTheme, setSavingTheme] = React.useState<AppTheme | null>(null)

  const loading = status === 'loading'
  const user = session?.user
  const safeLanguage = normalizeLocale(currentLanguage, enabledLanguages)
  const languageOptions = APP_LANGUAGE_OPTIONS.filter((option) =>
    enabledLanguages.includes(option.value),
  )

  const handleLogout = async () => {
    try {
      await logoutAction()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

  const toProfile = () => {
    router.push('/me')
  }

  const handleLanguageChange = async (locale: AppLocale) => {
    if (locale === safeLanguage || savingLanguage) return

    try {
      setSavingLanguage(locale)
      await updateCurrentUserLanguage(locale)
      notify.success(t('languageUpdated'))
      router.refresh()
    } catch (error) {
      notify.error(error, t('languageUpdateFailed'))
    } finally {
      setSavingLanguage(null)
    }
  }

  const handleThemeChange = async (theme: AppTheme) => {
    if (theme === currentTheme || savingTheme) return

    try {
      setSavingTheme(theme)
      setTheme(theme)
      await updateCurrentUserTheme(theme)
      notify.success(t('themeUpdated'))
      router.refresh()
    } catch (error) {
      notify.error(error, t('themeUpdateFailed'))
    } finally {
      setSavingTheme(null)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-3 bg-muted animate-pulse rounded mt-1" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Show nothing if no user (should not happen due to auth proxy checks)
  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="text-muted-foreground">{t('notLoggedIn')}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const displayName = user?.name || user?.email?.split('@')[0] || 'User'
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : 'U'

  const avatarUrl = user?.image || undefined

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="text-muted-foreground truncate text-xs">{user?.email}</span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-muted-foreground truncate text-xs">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
                {t('languages')}
              </DropdownMenuLabel>
              {languageOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className="cursor-pointer"
                  disabled={savingLanguage !== null}
                  onSelect={(event) => {
                    event.preventDefault()
                    void handleLanguageChange(option.value)
                  }}
                >
                  <Languages className="mr-2 h-4 w-4" />
                  <span>{option.nativeLabel}</span>
                  {safeLanguage === option.value && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
                {t('theme')}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={savingTheme !== null}
                onSelect={(event) => {
                  event.preventDefault()
                  void handleThemeChange('light')
                }}
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>{t('light')}</span>
                {currentTheme === 'light' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={savingTheme !== null}
                onSelect={(event) => {
                  event.preventDefault()
                  void handleThemeChange('dark')
                }}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>{t('dark')}</span>
                {currentTheme === 'dark' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer" onClick={toProfile}>
                <User className="mr-2 h-4 w-4" />
                <span>{t('profile')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
