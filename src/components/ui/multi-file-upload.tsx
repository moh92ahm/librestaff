'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Download, FileText, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export type MultiFileUploadValue =
  | File
  | string
  | {
      id: string
      filename?: string
      filesize?: number
      mimeType?: string
      url?: string
    }

type MultiFileUploadChangeHandler = {
  bivarianceHack(files: MultiFileUploadValue[]): void
}['bivarianceHack']

interface MultiFileUploadProps {
  value?: MultiFileUploadValue[]
  onChange?: MultiFileUploadChangeHandler
  name?: string
  label?: string
  placeholder?: string
  triggerLabel?: string
  className?: string
  maxFiles?: number
  accept?: string
  compactTrigger?: boolean
  indexedNames?: boolean
  disabled?: boolean
}

export function MultiFileUpload({
  value = [],
  onChange,
  name = 'documents',
  label = 'Documents',
  placeholder,
  triggerLabel,
  className,
  maxFiles = 10,
  accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png',
  compactTrigger = false,
  indexedNames = true,
  disabled = false,
}: MultiFileUploadProps) {
  const commonT = useTranslations('common')
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const objectUrlCache = React.useRef(new Map<File, string>())
  const resolvedPlaceholder = placeholder || commonT('uploadFiles')
  const resolvedTriggerLabel = triggerLabel || commonT('attachFile')

  React.useEffect(() => {
    const currentFiles = new Set(value.filter((file): file is File => file instanceof File))
    for (const [file, url] of objectUrlCache.current.entries()) {
      if (!currentFiles.has(file)) {
        URL.revokeObjectURL(url)
        objectUrlCache.current.delete(file)
      }
    }
  }, [value])

  React.useEffect(() => {
    return () => {
      for (const url of objectUrlCache.current.values()) {
        URL.revokeObjectURL(url)
      }
      objectUrlCache.current.clear()
    }
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      const remainingSlots = maxFiles - value.length
      const filesToAdd = files.slice(0, remainingSlots)
      onChange?.([...value, ...filesToAdd])
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index)
    onChange?.(newFiles)
  }

  const handleClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const getFileName = (file: MultiFileUploadValue): string => {
    // Check if it's a Media object with filename
    if (typeof file === 'object' && file !== null && 'filename' in file) {
      return file.filename ?? 'Document'
    }
    // Check if it's a File object by checking for properties
    if (typeof file === 'object' && file !== null && 'name' in file) {
      return file.name
    }
    // Extract filename from URL or ID
    if (typeof file === 'string') {
      // If it's a URL, get the last part
      const parts = file.split('/')
      return parts[parts.length - 1] || 'Document'
    }
    return commonT('file')
  }

  const getFileSize = (file: MultiFileUploadValue): string => {
    // Check if it's a Media object with filesize
    if (typeof file === 'object' && file !== null && 'filesize' in file) {
      const bytes = file.filesize ?? 0
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
    // Check if it's a File object by checking for properties
    if (typeof file === 'object' && file !== null && 'size' in file) {
      const bytes = file.size
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
    return ''
  }

  const getFileUrl = (file: MultiFileUploadValue): string | null => {
    if (file instanceof File) {
      if (!objectUrlCache.current.has(file)) {
        objectUrlCache.current.set(file, URL.createObjectURL(file))
      }
      return objectUrlCache.current.get(file) || null
    }
    if (typeof file === 'object' && file !== null && 'url' in file && file.url) {
      return file.url
    }
    if (typeof file === 'string' && file.startsWith('/')) return file
    return null
  }

  const isImageFile = (file: MultiFileUploadValue) => {
    if (file instanceof File) return file.type.startsWith('image/')
    if (typeof file === 'object' && file !== null && 'mimeType' in file && file.mimeType) {
      return file.mimeType.startsWith('image/')
    }
    const filename = getFileName(file).toLowerCase()
    return /\.(png|jpe?g|webp|gif|avif)$/i.test(filename)
  }

  const FilePreview = ({ file, compact = false }: { file: MultiFileUploadValue; compact?: boolean }) => {
    const url = getFileUrl(file)
    if (url && isImageFile(file)) {
      return (
        <img
          src={url}
          alt={getFileName(file)}
          className={cn(
            'shrink-0 rounded border bg-background object-cover',
            compact ? 'size-5' : 'size-10',
          )}
        />
      )
    }

    return (
      <FileText
        className={cn(
          'shrink-0 text-muted-foreground',
          compact ? 'h-3.5 w-3.5' : 'h-5 w-5',
        )}
      />
    )
  }

  const isFileObject = (file: MultiFileUploadValue): file is File => {
    return (
      typeof file === 'object' &&
      file !== null &&
      ('name' in file || 'filename' in file) &&
      ('size' in file || 'filesize' in file)
    )
  }

  const hiddenInputs = value.map((file, index) => {
    // Only add File objects (with 'name' property) to DataTransfer
    // Media objects (with 'filename') and strings will be handled separately
    if (isFileObject(file) && 'name' in file && typeof file.name === 'string') {
      return (
        <input
          key={`file-${index}`}
          type="file"
          name={indexedNames ? `${name}[${index}]` : name}
          className="hidden"
          ref={(input) => {
            if (input) {
              const dataTransfer = new DataTransfer()
              dataTransfer.items.add(file as File)
              input.files = dataTransfer.files
            }
          }}
        />
      )
    }
    // For Media objects and string IDs, create hidden inputs with the ID
    if (typeof file === 'object' && file !== null && 'id' in file) {
      return (
        <input
          key={`doc-${index}`}
          type="hidden"
          name={indexedNames ? `${name}[${index}]` : name}
          value={String(file.id)}
        />
      )
    }
    if (typeof file === 'string') {
      return (
        <input
          key={`doc-${index}`}
          type="hidden"
          name={indexedNames ? `${name}[${index}]` : name}
          value={file}
        />
      )
    }
    return null
  })

  if (compactTrigger) {
    return (
      <div className={cn('contents', className)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={disabled || value.length >= maxFiles}
        >
          <Upload className="h-4 w-4" />
          {resolvedTriggerLabel}
          {value.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {value.length}/{maxFiles}
            </span>
          )}
        </Button>

        {value.length > 0 && (
          <div className="flex basis-full flex-wrap gap-2">
            {value.map((file, index) => (
              <div
                key={index}
                className="inline-flex max-w-48 items-center gap-2 rounded-full border bg-muted/60 px-2.5 py-1 text-xs"
              >
                <FilePreview file={file} compact />
                {getFileUrl(file) ? (
                  <a
                    href={getFileUrl(file) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="min-w-0 truncate hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {getFileName(file)}
                  </a>
                ) : (
                  <span className="min-w-0 truncate">{getFileName(file)}</span>
                )}
                {isFileObject(file) && (
                  <span className="shrink-0 text-muted-foreground">{getFileSize(file)}</span>
                )}
                <button
                  type="button"
                  className="shrink-0 text-destructive hover:text-destructive/80"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  aria-label={commonT('removeFile', { file: getFileName(file) })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        {hiddenInputs}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}

      {/* File list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted rounded-md border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FilePreview file={file} />
                <div className="flex-1 min-w-0">
                  {getFileUrl(file) ? (
                    <a
                      href={getFileUrl(file) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {getFileName(file)}
                    </a>
                  ) : (
                    <p className="text-sm font-medium truncate">{getFileName(file)}</p>
                  )}
                  {isFileObject(file) && (
                    <p className="text-xs text-muted-foreground">{getFileSize(file)}</p>
                  )}
                </div>
              </div>
              {getFileUrl(file) && (
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                  <a
                    href={getFileUrl(file) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    aria-label={commonT('download')}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && value.length < maxFiles && (
        <div
          onClick={handleClick}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted-foreground/25 rounded-md hover:border-muted-foreground/50 transition-colors cursor-pointer"
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">{resolvedPlaceholder}</p>
          <p className="text-xs text-muted-foreground">
            {commonT('filesUploaded', { count: value.length, max: maxFiles })}
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
      />

      {/* Hidden inputs for files to be submitted with form */}
      {hiddenInputs}

      {!compactTrigger && (
        <p className="text-xs text-muted-foreground">
          {commonT('supportedFormats', {
            formats: accept
              .split(',')
              .map((format) => format.replace('.', '').toUpperCase())
              .join(', '),
            max: maxFiles,
          })}
        </p>
      )}
    </div>
  )
}
