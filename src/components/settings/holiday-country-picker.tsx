'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { HolidayCountryOption } from '@/lib/holiday-utils'
import { useTranslations } from 'next-intl'

type HolidayCountryPickerProps = {
  name: string
  options: HolidayCountryOption[]
  defaultValue?: string[]
}

export function HolidayCountryPicker({
  name,
  options,
  defaultValue = [],
}: HolidayCountryPickerProps) {
  const t = useTranslations('settings')
  const [open, setOpen] = React.useState(false)
  const [selectedValues, setSelectedValues] = React.useState(() => new Set(defaultValue))

  const selectedOptions = options.filter((option) => selectedValues.has(option.value))

  function toggleValue(value: string) {
    setSelectedValues((current) => {
      const next = new Set(current)

      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }

      return next
    })
  }

  function removeValue(value: string, event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()

    setSelectedValues((current) => {
      const next = new Set(current)
      next.delete(value)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {Array.from(selectedValues).map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between gap-3 whitespace-normal"
          >
            <span className="flex min-w-0 flex-1 flex-wrap gap-1 text-left">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <Badge key={option.value} variant="secondary">
                    {option.label}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${option.label}`}
                      className="ml-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(event) => removeValue(option.value, event)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          removeValue(option.value, event)
                        }
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                    >
                      <X className="size-3" />
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t('selectHolidayCalendars')}
                </span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(520px,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder={t('searchCountries')} />
            <CommandList>
              <CommandEmpty>{t('noSupportedCountry')}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        selectedValues.has(option.value) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span>{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-sm text-muted-foreground">
        {t('holidayCalendarsHelp')}
      </p>
    </div>
  )
}
