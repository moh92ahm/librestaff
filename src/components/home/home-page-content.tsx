'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Gift,
  Megaphone,
  UserRound,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HomeClock } from '@/components/home/home-clock'
import type { HomeEventPreview, HomePageData } from '@/lib/actions/home'

type HomePageContentProps = {
  home: HomePageData
  userName?: string | null
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function eventIcon(type: HomeEventPreview['type']) {
  if (type === 'birthday') return <Gift className="h-4 w-4 text-pink-600" />
  return <CalendarDays className="h-4 w-4 text-primary" />
}

function AttentionItems({ home }: { home: HomePageData }) {
  const t = useTranslations('home')
  const locale = useLocale()

  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('attentionTitle')}</h2>
          <Badge variant="secondary">{home.attentionItems.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t('attentionDescription')}</p>
      </div>

      {home.attentionItems.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{t('allCaughtUpTitle')}</h3>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {t('allCaughtUpDescription')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {home.attentionItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                {item.type === 'leaveApproval' ? (
                  <ClipboardCheck className="size-5" />
                ) : (
                  <AlertCircle className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">
                  {item.type === 'leaveApproval'
                    ? t('leaveApprovalTitle')
                    : t('incompleteProfileTitle')}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.type === 'leaveApproval'
                    ? t('leaveApprovalDescription', {
                        name: item.personName,
                        date: formatDate(item.submittedAt, locale),
                      })
                    : t('incompleteProfileDescription', {
                        count: item.missingFields.length,
                      })}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={item.href}>
                  {item.type === 'leaveApproval' ? t('reviewAction') : t('completeAction')}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePageContent({ home, userName }: HomePageContentProps) {
  const t = useTranslations('home')
  const locale = useLocale()
  const firstName = userName?.split(' ')[0] || t('fallbackName')
  const eventList = home.upcomingEvents.slice(0, 6)

  return (
    <div className="flex flex-1 flex-col overflow-auto px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex w-full flex-col gap-5">
        <section className="home-hero-gradient relative overflow-hidden rounded-xl border p-5 shadow-sm md:p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="max-w-5xl space-y-5">
              <div>
                <HomeClock
                  className="mb-2 text-left md:hidden"
                  dateClassName="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  timeClassName="hidden"
                />
                <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
                  {t('welcome', { name: firstName })}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  {t('summary', {
                    announcements: home.announcementCount,
                    events: home.upcomingEventCount,
                  })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <Badge className="border border-border/60 bg-background/80 px-3 py-1 text-foreground hover:bg-background/80 dark:bg-background/65 dark:hover:bg-background/65">
                  <Megaphone className="h-3.5 w-3.5" />
                  {t('announcementCount', { count: home.announcementCount })}
                </Badge>
                <Badge className="border border-border/60 bg-background/80 px-3 py-1 text-foreground hover:bg-background/80 dark:bg-background/65 dark:hover:bg-background/65">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t('eventCount', { count: home.upcomingEventCount })}
                </Badge>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/me">
                    <UserRound className="h-4 w-4" />
                    {t('profileCta')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t('profileHelper')}
                </p>
              </div>
            </div>

            <div className="hidden rounded-xl border border-border/60 bg-card/75 px-4 py-3 shadow-xs backdrop-blur md:block xl:min-w-80">
              <div className="min-w-0">
                <HomeClock dateClassName="text-muted-foreground" timeClassName="text-foreground" />
              </div>
            </div>
          </div>
        </section>

        <div className="md:hidden">
          <AttentionItems home={home} />
        </div>

        <div className="hidden gap-6 md:grid xl:grid-cols-[360px_minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t('upcomingEvents')}</h2>
              <p className="text-sm text-muted-foreground">{t('upcomingEventsDescription')}</p>
            </div>

            {eventList.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                {t('noUpcomingEvents')}
              </div>
            ) : (
              <div className="space-y-2">
                {eventList.map((event) => (
                  <Link
                    href="/calendar"
                    key={event.id}
                    className="block rounded-lg border bg-card p-3 shadow-xs transition hover:border-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">{eventIcon(event.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium">{event.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(event.startAt, locale)} | {formatTime(event.startAt, locale)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t('recentAnnouncements')}</h2>
              <p className="text-sm text-muted-foreground">{t('recentAnnouncementsDescription')}</p>
            </div>

            {home.announcements.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                {t('noRecentAnnouncements')}
              </div>
            ) : (
              <div className="space-y-3">
                {home.announcements.map((announcement) => (
                  <Link
                    href={`/announcements/${announcement.id}`}
                    key={announcement.id}
                    className="block rounded-lg border bg-card p-4 shadow-xs transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {announcement.categoryName && (
                            <Badge
                              variant="outline"
                              style={
                                announcement.categoryColor
                                  ? ({
                                      borderColor: announcement.categoryColor,
                                      color: announcement.categoryColor,
                                    } as CSSProperties)
                                  : undefined
                              }
                            >
                              {announcement.categoryName}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(announcement.sentAt || announcement.createdAt, locale)}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 font-medium">{announcement.title}</h3>
                        {announcement.bodyPreview && (
                          <p className="line-clamp-3 text-sm text-muted-foreground">
                            {announcement.bodyPreview}
                          </p>
                        )}
                      </div>
                      <Megaphone className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0">
            <AttentionItems home={home} />
          </aside>
        </div>
      </div>
    </div>
  )
}
