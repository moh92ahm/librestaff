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

export type CalendarEventType = 'birthday' | 'anniversary' | 'event' | 'holiday' | 'leave'

const typeOptions: Array<{
  value: CalendarEventType
  labelKey: 'birthdays' | 'anniversaries' | 'events' | 'holidays' | 'leaves'
  dotClass: string
}> = [
  { value: 'birthday', labelKey: 'birthdays', dotClass: 'bg-rose-500' },
  { value: 'anniversary', labelKey: 'anniversaries', dotClass: 'bg-violet-500' },
  { value: 'event', labelKey: 'events', dotClass: 'bg-blue-500' },
  { value: 'holiday', labelKey: 'holidays', dotClass: 'bg-amber-500' },
  { value: 'leave', labelKey: 'leaves', dotClass: 'bg-emerald-500' },
]

export const allCalendarEventTypes = typeOptions.map((option) => option.value)

function FilterOptions({
  selectedTypes,
  onToggle,
  onSelectAll,
}: {
  selectedTypes: Set<CalendarEventType>
  onToggle: (type: CalendarEventType) => void
  onSelectAll: () => void
}) {
  const t = useTranslations('calendar')
  const allSelected = selectedTypes.size === typeOptions.length

  return (
    <div className="space-y-2">
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
        <span className="flex-1">{t('allItems')}</span>
      </button>

      <div className="overflow-hidden rounded-xl border">
        {typeOptions.map((option, index) => {
          const checked = selectedTypes.has(option.value)
          const isLastSelected = checked && selectedTypes.size === 1

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
              <span className="flex-1 text-sm font-medium">{t(option.labelKey)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarTypeFilter({
  selectedTypes,
  onToggle,
  onSelectAll,
}: {
  selectedTypes: Set<CalendarEventType>
  onToggle: (type: CalendarEventType) => void
  onSelectAll: () => void
}) {
  const t = useTranslations('calendar')
  const selectedOptions = typeOptions.filter((option) => selectedTypes.has(option.value))
  const summary =
    selectedOptions.length === typeOptions.length
      ? t('allItems')
      : selectedOptions.length <= 2
        ? selectedOptions.map((option) => t(option.labelKey)).join(', ')
        : t('typesSelected', { count: selectedOptions.length })

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
          <PopoverContent align="start" className="w-72">
            <div className="mb-3">
              <h2 className="text-sm font-semibold">{t('filterCalendar')}</h2>
              <p className="text-xs text-muted-foreground">{t('filterCalendarDescription')}</p>
            </div>
            <FilterOptions
              selectedTypes={selectedTypes}
              onToggle={onToggle}
              onSelectAll={onSelectAll}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-w-0 flex-1 sm:hidden">
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[80dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{t('filterCalendar')}</SheetTitle>
              <SheetDescription>{t('filterCalendarDescription')}</SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4">
              <FilterOptions
                selectedTypes={selectedTypes}
                onToggle={onToggle}
                onSelectAll={onSelectAll}
              />
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
