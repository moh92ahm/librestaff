'use client'

import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { useState } from 'react'
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
import { Label } from '@/components/ui/label'

export interface Option {
  value: string
  label: string
}

interface ComboboxMultiSelectProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label?: string
  placeholder?: string
  options: Option[]
  error?: string
  searchPlaceholder?: string
  emptyMessage?: string
}

export function ComboboxMultiSelect<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Select items...',
  options,
  error,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found.',
}: ComboboxMultiSelectProps<TFieldValues>) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {label && (
        <Label htmlFor={String(name)} className="mb-2 block">
          {label}
        </Label>
      )}
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const selectedValues = (field.value as string[]) || []

          const handleSelect = (value: string) => {
            const newValues = selectedValues.includes(value)
              ? selectedValues.filter((v) => v !== value)
              : [...selectedValues, value]
            field.onChange(newValues)
          }

          const handleRemove = (value: string, e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            const newValues = selectedValues.filter((v) => v !== value)
            field.onChange(newValues)
          }

          return (
            <div className="space-y-2">
              {/* Hidden inputs for form submission */}
              {selectedValues.map((value, index) => (
                <input
                  key={`${String(name)}-${index}`}
                  type="hidden"
                  name={`${String(name)}[${index}]`}
                  value={value}
                />
              ))}

              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    aria-expanded={open}
                    className={cn('w-full justify-between', error && 'border-destructive')}
                    role="combobox"
                    variant="outline"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedValues.length > 0 ? (
                        selectedValues.map((value) => (
                          <Badge className="mr-1" key={value} variant="secondary">
                            {options.find((option) => option.value === value)?.label}
                            <span
                              className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                              onClick={(e) => handleRemove(value, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRemove(value, e as any)
                                }
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <X className="size-3 text-muted-foreground hover:text-foreground" />
                            </span>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                      <CommandEmpty>{emptyMessage}</CommandEmpty>
                      <CommandGroup>
                        {options.map((option) => (
                          <CommandItem
                            key={option.value}
                            onSelect={() => handleSelect(option.value)}
                            value={option.value}
                          >
                            <Check
                              className={cn(
                                'mr-2 size-4',
                                selectedValues.includes(option.value) ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>
          )
        }}
      />
    </div>
  )
}
