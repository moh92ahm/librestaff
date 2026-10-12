'use client'

import { Check, ChevronDown, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type LeaveTypeFilter = 'annual' | 'sick' | 'unpaid' | 'other'
export type LeaveStatusFilter = 'requested' | 'approved' | 'rejected' | 'cancelled'

const typeOptions: Array<{ value: LeaveTypeFilter; dotClass: string }> = [
  { value: 'annual', dotClass: 'bg-blue-500' },
  { value: 'sick', dotClass: 'bg-rose-500' },
  { value: 'unpaid', dotClass: 'bg-amber-500' },
  { value: 'other', dotClass: 'bg-slate-500' },
]

const statusOptions: Array<{ value: LeaveStatusFilter; dotClass: string }> = [
  { value: 'requested', dotClass: 'bg-amber-500' },
  { value: 'approved', dotClass: 'bg-emerald-500' },
  { value: 'rejected', dotClass: 'bg-rose-500' },
  { value: 'cancelled', dotClass: 'bg-slate-500' },
]

export const allLeaveTypes = typeOptions.map((option) => option.value)
export const allLeaveStatuses = statusOptions.map((option) => option.value)

function FilterGroup<T extends string>({
  title,
  allLabel,
  options,
  selected,
  getLabel,
  onToggle,
  onSelectAll,
}: {
  title: string
  allLabel: string
  options: Array<{ value: T; dotClass: string }>
  selected: Set<T>
  getLabel: (value: T) => string
  onToggle: (value: T) => void
  onSelectAll: () => void
}) {
  const allSelected = selected.size === options.length

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <button
        type="button"
        onClick={onSelectAll}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-muted',
          allSelected && 'bg-muted/70 text-foreground',
        )}
      >
        <span className="flex size-5 items-center justify-center">
          {allSelected && <Check className="size-4" />}
        </span>
        <span className="flex-1">{allLabel}</span>
      </button>

      <div className="overflow-hidden rounded-xl border">
        {options.map((option, index) => {
          const checked = selected.has(option.value)
          const isLastSelected = checked && selected.size === 1

          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-12 items-center gap-3 px-3',
                index > 0 && 'border-t',
                isLastSelected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <Checkbox
                checked={checked}
                disabled={isLastSelected}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className={cn('size-2.5 shrink-0 rounded-full', option.dotClass)} />
              <span className="flex-1 text-sm font-medium">{getLabel(option.value)}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

type LeaveFilterProps = {
  selectedTypes: Set<LeaveTypeFilter>
  selectedStatuses: Set<LeaveStatusFilter>
  onToggleType: (type: LeaveTypeFilter) => void
  onToggleStatus: (status: LeaveStatusFilter) => void
  onSelectAllTypes: () => void
  onSelectAllStatuses: () => void
}

function FilterOptions(props: LeaveFilterProps) {
  const t = useTranslations('leaves')
  const statusT = useTranslations('labels.statuses')
  const leaveTypeT = useTranslations('labels.leaveTypes')

  return (
    <div className="space-y-5">
      <FilterGroup
        title={t('leaveTypeFilter')}
        allLabel={t('allLeaveTypes')}
        options={typeOptions}
        selected={props.selectedTypes}
        getLabel={(value) => leaveTypeT(value)}
        onToggle={props.onToggleType}
        onSelectAll={props.onSelectAllTypes}
      />
      <FilterGroup
        title={t('requestStatusFilter')}
        allLabel={t('allRequestStatuses')}
        options={statusOptions}
        selected={props.selectedStatuses}
        getLabel={(value) => statusT(value)}
        onToggle={props.onToggleStatus}
        onSelectAll={props.onSelectAllStatuses}
      />
    </div>
  )
}

export function LeaveFilter(props: LeaveFilterProps) {
  const t = useTranslations('leaves')
  const statusT = useTranslations('labels.statuses')
  const leaveTypeT = useTranslations('labels.leaveTypes')
  const allTypesSelected = props.selectedTypes.size === typeOptions.length
  const allStatusesSelected = props.selectedStatuses.size === statusOptions.length
  const restrictedLabels = [
    ...(allTypesSelected
      ? []
      : typeOptions
          .filter((option) => props.selectedTypes.has(option.value))
          .map((option) => leaveTypeT(option.value))),
    ...(allStatusesSelected
      ? []
      : statusOptions
          .filter((option) => props.selectedStatuses.has(option.value))
          .map((option) => statusT(option.value))),
  ]
  const summary =
    restrictedLabels.length === 0
      ? t('allLeaveRequests')
      : restrictedLabels.length <= 2
        ? restrictedLabels.join(', ')
        : t('filtersSelected', { count: restrictedLabels.length })

  const trigger = (
    <Button type="button" variant="outline" className="min-w-0 max-w-full justify-between gap-2">
      <Filter className="size-4 shrink-0" />
      <span className="truncate">{summary}</span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  )

  return (
    <>
      <div className="hidden sm:block">
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="max-h-[75dvh] w-80 overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">{t('filterLeaves')}</h2>
              <p className="text-xs text-muted-foreground">{t('filterLeavesDescription')}</p>
            </div>
            <FilterOptions {...props} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-w-0 sm:hidden">
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{t('filterLeaves')}</SheetTitle>
              <SheetDescription>{t('filterLeavesDescription')}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4">
              <FilterOptions {...props} />
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="button">{t('done')}</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
