import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { InferSelectModel } from 'drizzle-orm'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Pencil, PackagePlus, UserRound, Activity } from 'lucide-react'
import { inventoryLogsTable, inventoryTable, usersTable } from '@/db/schema'
import { formatDate } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'

type InventoryUser = Pick<InferSelectModel<typeof usersTable>, 'fullName'>

export type InventoryDetailItem = InferSelectModel<typeof inventoryTable> & {
  holder?: InventoryUser | null
  images?: unknown
}

export type InventoryDetailLog = InferSelectModel<typeof inventoryLogsTable> & {
  actor?: InventoryUser | null
}

type InventoryImage = {
  id?: string
  url: string
}

type InventoryDetailViewProps = {
  item: InventoryDetailItem
  logs: InventoryDetailLog[]
  logTotal: number
  currentPage: number
  pageSize: number
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  inUse: 'default',
  inStock: 'secondary',
  needsRepair: 'destructive',
  underRepair: 'outline',
}

function inventoryImages(value: unknown): InventoryImage[] {
  if (!Array.isArray(value)) return []

  return value.filter((image): image is InventoryImage => {
    return Boolean(image && typeof image === 'object' && 'url' in image && image.url)
  })
}

export async function InventoryDetailView({
  item,
  logs,
  logTotal,
  currentPage,
  pageSize,
}: InventoryDetailViewProps) {
  const [locale, t, enumT, common] = await Promise.all([
    getLocale(),
    getTranslations('inventory'),
    getTranslations('enums'),
    getTranslations('common'),
  ])

  const totalPages = Math.max(1, Math.ceil(logTotal / pageSize))

  const statusLabel = (status: string) => {
    try {
      return enumT(`inventoryStatus.${status}` as never)
    } catch {
      return status
    }
  }

  const holderName =
    item.holder && typeof item.holder === 'object' && 'fullName' in item.holder
      ? item.holder.fullName
      : null

  const images = inventoryImages(item.images)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <SetBreadcrumbLabel label={item.model} />

        <div className="flex items-start gap-2 sm:items-center sm:gap-4">
          <Link href="/inventory" className="shrink-0">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {common('back')}
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl leading-tight font-semibold sm:text-2xl">
              {item.model}
            </h1>
            <p className="mt-1 break-all font-mono text-sm text-muted-foreground">
              {item.serialNumber}
            </p>
          </div>
          <Link href={`/inventory/${item.id}/edit`} className="shrink-0">
            <Button
              variant="outline"
              size="icon-sm"
              className="sm:hidden"
              aria-label={t('editItem')}
              title={t('editItem')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Pencil className="mr-2 h-4 w-4" />
              {t('editItem')}
            </Button>
          </Link>
        </div>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold">{t('inventoryDetails')}</h2>
          </div>
          <div className="divide-y">
            <DetailRow label={t('itemType')}>
              <span>{enumT(`inventoryType.${item.itemType}` as never)}</span>
            </DetailRow>

            <DetailRow label={common('status')}>
              <Badge variant={STATUS_VARIANTS[item.status] ?? 'default'}>
                {statusLabel(item.status)}
              </Badge>
            </DetailRow>

            <DetailRow label={t('model')}>
              <span>{item.model}</span>
            </DetailRow>

            <DetailRow label={t('serialNumber')}>
              <span className="font-mono text-sm">{item.serialNumber}</span>
            </DetailRow>

            <DetailRow label={t('holder')}>
              <span>
                {holderName ?? <span className="text-muted-foreground">{t('unassigned')}</span>}
              </span>
            </DetailRow>

            <DetailRow label={t('purchaseDate')}>
              <span>
                {item.purchaseDate ? (
                  formatDate(item.purchaseDate, locale)
                ) : (
                  <span className="text-muted-foreground">{common('notSpecified')}</span>
                )}
              </span>
            </DetailRow>

            <DetailRow label={t('warrantyExpiry')}>
              <span>
                {item.warrantyExpiry ? (
                  formatDate(item.warrantyExpiry, locale)
                ) : (
                  <span className="text-muted-foreground">{common('notSpecified')}</span>
                )}
              </span>
            </DetailRow>

            {item.notes ? (
              <DetailRow label={t('notes')}>
                <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
              </DetailRow>
            ) : null}

            {images.length > 0 ? (
              <DetailRow label={t('images')}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {images.map((image, index) => (
                    <Image
                      key={image.id ?? image.url}
                      src={image.url}
                      alt={t('imageAlt', { number: index + 1 })}
                      width={160}
                      height={160}
                      unoptimized
                      className="aspect-square w-full rounded object-cover"
                    />
                  ))}
                </div>
              </DetailRow>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-base font-semibold">{t('activityLog')}</h2>
            {logTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, logTotal)} /{' '}
                {logTotal}
              </span>
            )}
          </div>
          {logs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('noActivity')}
            </div>
          ) : (
            <ul className="divide-y">
              {logs.map((log) => {
                const actorName =
                  log.actor && typeof log.actor === 'object' && 'fullName' in log.actor
                    ? log.actor.fullName
                    : null

                const { description, Icon } = getLogPresentation(log, statusLabel, t, common)

                return (
                  <li key={log.id} className="flex items-start gap-3 px-5 py-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{description}</p>
                      {actorName ? (
                        <p className="text-xs text-muted-foreground">{actorName}</p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(log.createdAt, locale)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-5 py-3">
              <Link
                href={`/inventory/${item.id}?logPage=${currentPage - 1}`}
                aria-disabled={currentPage <= 1}
                className={currentPage <= 1 ? 'pointer-events-none opacity-40' : ''}
              >
                <Button variant="outline" size="sm" disabled={currentPage <= 1}>
                  {common('previous')}
                </Button>
              </Link>
              <span className="text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Link
                href={`/inventory/${item.id}?logPage=${currentPage + 1}`}
                aria-disabled={currentPage >= totalPages}
                className={currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''}
              >
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages}>
                  {common('next')}
                </Button>
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function getLogPresentation(
  log: InventoryDetailLog,
  statusLabel: (status: string) => string,
  t: Awaited<ReturnType<typeof getTranslations>>,
  common: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (log.eventType === 'created') {
    return {
      Icon: PackagePlus,
      description: t('logCreated'),
    }
  }

  if (log.eventType === 'statusChanged') {
    const from = log.oldValue ? statusLabel(log.oldValue) : common('unknown')
    const to = log.newValue ? statusLabel(log.newValue) : common('unknown')

    return {
      Icon: Activity,
      description: t('logStatusChanged', { from, to }),
    }
  }

  const from = log.oldLabel ?? (log.oldValue ? log.oldValue : t('unassigned'))
  const to = log.newLabel ?? (log.newValue ? log.newValue : t('unassigned'))

  return {
    Icon: UserRound,
    description: t('logHolderChanged', { from, to }),
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-8">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
