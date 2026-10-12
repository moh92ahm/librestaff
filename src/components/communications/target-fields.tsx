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
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export type TargetOption = {
  value: string
  label: string
  departmentIds?: string[]
}

type TargetType = 'everyone' | 'departments' | 'users'

interface TargetFieldsProps {
  targetType?: string
  departmentOptions: TargetOption[]
  userOptions: TargetOption[]
  selectedDepartmentIds?: string[]
  selectedUserIds?: string[]
  disabled?: boolean
}

interface MultiTargetPickerProps {
  name: string
  label: string
  options: TargetOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
  disabled?: boolean
}

function normalizeTargetType(value?: string): TargetType {
  return value === 'departments' || value === 'users' ? value : 'everyone'
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function MultiTargetPicker({
  name,
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
}: MultiTargetPickerProps) {
  const t = useTranslations('targetFields')
  const [open, setOpen] = React.useState(false)
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value))
  const dropdownOptions = [
    ...selectedOptions,
    ...options.filter((option) => !selectedValues.includes(option.value)),
  ]

  function toggleValue(value: string) {
    if (disabled) return

    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    )
  }

  function removeValue(value: string, event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (disabled) return
    onChange(selectedValues.filter((selectedValue) => selectedValue !== value))
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selectedValues.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
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
                      aria-label={t('removeTarget', { label: option.label })}
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
                <span className="text-sm text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(520px,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {dropdownOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggleValue(option.value)}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0',
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
    </div>
  )
}

export function TargetFields({
  targetType = 'everyone',
  departmentOptions,
  userOptions,
  selectedDepartmentIds = [],
  selectedUserIds = [],
  disabled = false,
}: TargetFieldsProps) {
  const t = useTranslations('targetFields')
  const [selectedTargetType, setSelectedTargetType] = React.useState<TargetType>(
    normalizeTargetType(targetType),
  )
  const [departmentIds, setDepartmentIds] = React.useState(() =>
    uniqueValues(selectedDepartmentIds),
  )
  const [userIds, setUserIds] = React.useState(() => uniqueValues(selectedUserIds))

  function handleTargetTypeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextTargetType = normalizeTargetType(event.target.value)
    if (disabled) return

    setSelectedTargetType(nextTargetType)

    if (nextTargetType !== 'departments') {
      setDepartmentIds([])
    }

    if (nextTargetType !== 'users') {
      setUserIds([])
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="targetType">{t('audience')}</Label>
        <select
          id="targetType"
          name="targetType"
          value={selectedTargetType}
          onChange={handleTargetTypeChange}
          disabled={disabled}
          className="border-input bg-background h-10 rounded-md border px-3 text-sm"
        >
          <option value="everyone">{t('everyone')}</option>
          <option value="departments">{t('selectedDepartments')}</option>
          <option value="users">{t('selectedPeople')}</option>
        </select>
        {selectedTargetType === 'everyone' && (
          <p className="text-sm text-muted-foreground">{t('allActiveUsersHelp')}</p>
        )}
      </div>

      {selectedTargetType === 'departments' && (
        <MultiTargetPicker
          name="departmentIds"
          label={t('departments')}
          options={departmentOptions}
          selectedValues={departmentIds}
          onChange={setDepartmentIds}
          placeholder={t('selectDepartments')}
          searchPlaceholder={t('searchDepartments')}
          emptyMessage={t('noDepartmentsFound')}
          disabled={disabled}
        />
      )}

      {selectedTargetType === 'users' && (
        <MultiTargetPicker
          name="userIds"
          label={t('people')}
          options={userOptions}
          selectedValues={userIds}
          onChange={setUserIds}
          placeholder={t('searchAndSelectPeople')}
          searchPlaceholder={t('searchPeople')}
          emptyMessage={t('noPeopleFound')}
          disabled={disabled}
        />
      )}
    </div>
  )
}
