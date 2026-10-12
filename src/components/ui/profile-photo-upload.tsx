'use client'

import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { User, Camera, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfilePhotoUploadProps {
  value?: File | string | null
  onChange?: (file: File | null) => void
  name?: string
  placeholder?: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-20 w-20',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
}

export function ProfilePhotoUpload({
  value,
  onChange,
  name,
  placeholder = 'Upload profile photo',
  className,
  size = 'lg',
}: ProfilePhotoUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value)
      setPreview(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else if (typeof value === 'string' && value) {
      setPreview(value)
    } else {
      setPreview(null)
    }
  }, [value])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onChange?.(file)
    }
  }

  const handleRemove = () => {
    onChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* <Label className="text-sm font-medium">{placeholder}</Label> */}

      <div className="relative group">
        <Avatar
          className={cn(
            sizeClasses[size],
            'cursor-pointer border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors',
          )}
        >
          <AvatarImage src={preview || undefined} className="object-cover" />
          <AvatarFallback className="bg-muted">
            <User
              className={cn(
                'text-muted-foreground',
                size === 'sm' && 'h-6 w-6',
                size === 'md' && 'h-8 w-8',
                size === 'lg' && 'h-10 w-10',
                size === 'xl' && 'h-12 w-12',
              )}
            />
          </AvatarFallback>
        </Avatar>

        {/* Overlay with camera icon */}
        <div
          onClick={handleClick}
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ',
            sizeClasses[size],
          )}
        >
          <Camera
            className={cn(
              size === 'sm' && 'h-4 w-4',
              size === 'md' && 'h-5 w-5',
              size === 'lg' && 'h-6 w-6',
              size === 'xl' && 'h-7 w-7',
            )}
          />
        </div>

        {/* Remove button */}
        {preview && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        name={name}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload button alternative
      <Button type="button" variant="outline" size="sm" onClick={handleClick} className="text-xs">
        {preview ? 'Change Photo' : 'Select Photo'}
      </Button> */}
    </div>
  )
}
