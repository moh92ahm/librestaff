'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { FieldPath, FieldValues, UseFormRegister } from 'react-hook-form'

interface InputFieldProps<TFieldValues extends FieldValues> {
  label: string
  name: FieldPath<TFieldValues>
  register: UseFormRegister<TFieldValues>
  type?: string
  placeholder?: string
  error?: string
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  transformValue?: (value: string) => string
}

export function InputField<TFieldValues extends FieldValues>({
  label,
  name,
  register,
  type = 'text',
  placeholder,
  error,
  inputProps,
  transformValue,
}: InputFieldProps<TFieldValues>) {
  const field = register(name)

  return (
    <div>
      <Label htmlFor={String(name)}>{label}</Label>
      <Input
        id={String(name)}
        type={type}
        placeholder={placeholder}
        className={error ? 'border-red-500' : ''}
        {...inputProps}
        {...field}
        onChange={(event) => {
          if (transformValue) {
            event.target.value = transformValue(event.target.value)
          }

          field.onChange(event)
          inputProps?.onChange?.(event)
        }}
      />
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  )
}
