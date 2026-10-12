'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/form/select-field'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/date-picker'
import { MultiFileUpload } from '@/components/ui/multi-file-upload'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const InventorySchemaBase = z.object({
  itemType: z.enum(['laptop', 'phone', 'accessory', 'simCard', 'other'] as const, {
    error: 'Item type is required',
  }),
  holder: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  status: z.enum(['inUse', 'inStock', 'needsRepair', 'underRepair'] as const, {
    error: 'Status is required',
  }),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  notes: z.string().optional(),
  // Multiple images are submitted as repeated "image" fields.
})

const InventorySchema = InventorySchemaBase.superRefine((val, ctx) => {
  if (val.status === 'inUse') {
    if (!val.holder || val.holder === '__none__') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['holder'],
        message: 'Holder is required when status is In Use',
      })
    }
  }
})

export type InventoryFormValues = z.infer<typeof InventorySchema>
import type { InferSelectModel } from 'drizzle-orm'
import { inventoryTable } from '@/db/schema/inventory'

interface Option {
  value: string
  label: string
}

interface InventoryFormProps {
  mode: 'create' | 'edit'
  onSubmit?: (data: InventoryFormValues) => Promise<any>
  formAction?: (formData: FormData) => Promise<void>
  holders: Option[]
  initialData?: Partial<InferSelectModel<typeof inventoryTable>>
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </section>
  )
}

function EditRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-500">{message}</p>
}

export function InventoryForm({
  mode,
  onSubmit,
  formAction,
  holders,
  initialData,
}: InventoryFormProps) {
  const t = useTranslations('inventory')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(InventorySchema) as any,
    defaultValues: {
      itemType: (initialData?.itemType as any) || 'other',
      model: initialData?.model || '',
      serialNumber: initialData?.serialNumber || '',
      status: (initialData?.status as any) || 'inStock',
      purchaseDate: initialData?.purchaseDate
        ? new Date(initialData.purchaseDate).toISOString().split('T')[0]
        : undefined,
      warrantyExpiry: initialData?.warrantyExpiry
        ? new Date(initialData.warrantyExpiry).toISOString().split('T')[0]
        : undefined,
      notes: initialData?.notes || '',
    },
  })

  const formRef = React.useRef<HTMLFormElement>(null)
  const [nativeSubmitting, setNativeSubmitting] = React.useState(false)

  // Existing images (edit mode): keep/remove state
  const [existingImages, setExistingImages] = React.useState<
    Array<{ id: string; url?: string; keep: boolean }>
  >(() => {
    if (mode !== 'edit' || !initialData?.images) return []
    const arr = Array.isArray(initialData.images) ? initialData.images : []
    return arr
      .map((img: any) => ({
        id: typeof img === 'object' && img ? String(img.id) : String(img),
        url:
          typeof img === 'object' && img && 'url' in img
            ? (img.url as string | undefined)
            : undefined,
        keep: true,
      }))
      .filter((x) => x.id && x.id !== 'undefined')
  })

  const [newFiles, setNewFiles] = React.useState<File[]>([])

  const removeExistingImage = (id: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== id))
  }

  const statusOptions: Option[] = [
    { value: 'inUse', label: enumT('inventoryStatus.inUse') },
    { value: 'inStock', label: enumT('inventoryStatus.inStock') },
    { value: 'needsRepair', label: enumT('inventoryStatus.needsRepair') },
    { value: 'underRepair', label: enumT('inventoryStatus.underRepair') },
  ]

  const itemTypeOptions: Option[] = [
    { value: 'laptop', label: enumT('inventoryType.laptop') },
    { value: 'phone', label: enumT('inventoryType.phone') },
    { value: 'accessory', label: enumT('inventoryType.accessory') },
    { value: 'simCard', label: enumT('inventoryType.simCard') },
    { value: 'other', label: enumT('inventoryType.other') },
  ]

  const status = useWatch({ control, name: 'status' }) as string | undefined
  const holder = useWatch({ control, name: 'holder' }) as string | undefined

  React.useEffect(() => {
    if (!status) return
    if (status !== 'inUse') {
      if (holder !== '__none__') setValue('holder', '__none__', { shouldValidate: true })
    } else {
      if (holder === '__none__') setValue('holder', '', { shouldValidate: true })
    }
  }, [status])

  const holderOptions: Option[] = React.useMemo(() => {
    if (status === 'inUse') return holders
    return [{ value: '__none__', label: t('unassigned') }, ...holders]
  }, [holders, status])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/inventory">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {common('back')}
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">
              {mode === 'create' ? t('addInventoryItem') : t('editInventoryItem')}
            </h1>
          </div>
        </div>

        <form
          ref={formRef}
          action={formAction as any}
          onSubmit={!formAction ? handleSubmit(async (values) => onSubmit?.(values)) : undefined}
          className="space-y-6"
        >
          <EditSection title={t('inventoryDetails')}>
            <EditRow title={t('itemType')} description={t('editHelp.itemType')}>
              <SelectField
                control={control}
                name={'itemType'}
                placeholder={t('selectItemType')}
                options={itemTypeOptions}
                error={errors.itemType?.message as string | undefined}
              />
            </EditRow>

            <EditRow title={t('model')} description={t('editHelp.model')}>
              <Input
                id="model"
                className={errors.model ? 'border-red-500' : ''}
                {...register('model')}
              />
              <FieldError message={errors.model?.message as string | undefined} />
            </EditRow>

            <EditRow title={t('serialNumber')} description={t('editHelp.serialNumber')}>
              <Input
                id="serialNumber"
                className={errors.serialNumber ? 'border-red-500' : ''}
                {...register('serialNumber')}
              />
              <FieldError message={errors.serialNumber?.message as string | undefined} />
            </EditRow>

            <EditRow title={common('status')} description={t('editHelp.status')}>
              <SelectField
                control={control}
                name={'status'}
                placeholder={t('selectStatus')}
                options={statusOptions}
                error={errors.status?.message as string | undefined}
              />
            </EditRow>

            <EditRow title={t('holder')} description={t('editHelp.holder')}>
              <SelectField
                control={control}
                name={'holder'}
                placeholder={t('selectHolder')}
                options={holderOptions}
                error={errors.holder?.message as string | undefined}
                searchable={true}
              />
            </EditRow>

            <EditRow title={t('purchaseDate')} description={t('editHelp.purchaseDate')}>
              <Controller
                control={control}
                name="purchaseDate"
                render={({ field }) => (
                  <DatePicker
                    name={field.name}
                    label={t('purchaseDate')}
                    value={field.value}
                    onValueChange={field.onChange}
                    yearRange={{ from: 2000, to: new Date().getFullYear() + 5 }}
                    clearable
                  />
                )}
              />
            </EditRow>

            <EditRow title={t('warrantyExpiry')} description={t('editHelp.warrantyExpiry')}>
              <Controller
                control={control}
                name="warrantyExpiry"
                render={({ field }) => (
                  <DatePicker
                    name={field.name}
                    label={t('warrantyExpiry')}
                    value={field.value}
                    onValueChange={field.onChange}
                    yearRange={{ from: 2000, to: new Date().getFullYear() + 10 }}
                    clearable
                  />
                )}
              />
            </EditRow>

            <EditRow title={t('images')} description={t('editHelp.images')}>
              <div className="space-y-3">
                {mode === 'edit' && existingImages.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{t('existingImages')}</p>
                    <div className="flex flex-row gap-4">
                      {existingImages.map((img) => (
                        <div key={img.id} className="relative group">
                          <input type="hidden" name="keepImageIds" value={img.id} />
                          {img.url ? (
                            <Image
                              src={img.url}
                              alt="inventory"
                              width={128}
                              height={128}
                              unoptimized
                              className="h-32 w-32 object-cover rounded"
                            />
                          ) : (
                            <div className="h-32 w-32 bg-muted rounded" />
                          )}
                          <button
                            type="button"
                            onClick={() => removeExistingImage(img.id)}
                            className="absolute top-1 right-1 rounded-full bg-background/80 p-2 text-md shadow text-destructive hover:bg-red-300"
                            title={t('deleteImage')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <MultiFileUpload
                  value={newFiles}
                  onChange={(files) =>
                    setNewFiles(files.filter((file): file is File => file instanceof File))
                  }
                  name="image"
                  label=""
                  placeholder={t('uploadImages')}
                  accept="image/*"
                  maxFiles={10}
                  indexedNames={false}
                />
                <p className="text-xs text-muted-foreground">{t('multipleImages')}</p>
              </div>
            </EditRow>

            <EditRow title={t('notes')} description={t('editHelp.notes')}>
              <Textarea id="notes" rows={5} {...register('notes')} />
            </EditRow>
          </EditSection>

          <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
            <div className="mx-auto flex max-w-6xl justify-end gap-3">
              <Link href="/inventory">
                <Button type="button" variant="outline" className="cursor-pointer">
                  <X className="h-4 w-4 mr-2" />
                  {common('cancel')}
                </Button>
              </Link>
              <Button
                type={formAction ? 'button' : 'submit'}
                className="cursor-pointer disabled:cursor-not-allowed"
                disabled={isSubmitting || nativeSubmitting}
                onClick={async () => {
                  if (!formAction) return
                  const isValid = await trigger()
                  if (isValid) {
                    setNativeSubmitting(true)
                    formRef.current?.requestSubmit()
                  }
                }}
              >
                {isSubmitting || nativeSubmitting ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSubmitting || nativeSubmitting ? common('saving') : t('saveItem')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
