'use client'

import * as React from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { saveCategoryAction, deleteCategoryAction } from '@/lib/actions/announcement-feed'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslations } from 'next-intl'

const PRESET_COLORS = [
  { value: '#818cf8', key: 'indigo' },
  { value: '#a78bfa', key: 'violet' },
  { value: '#fb7185', key: 'rose' },
  { value: '#34d399', key: 'emerald' },
  { value: '#fbbf24', key: 'amber' },
  { value: '#94a3b8', key: 'slate' },
]

function ColorSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (v: string) => void
}) {
  const t = useTranslations('announcements')
  const selectedColor = PRESET_COLORS.find((color) => color.value === value)

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-36">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: value }}
            />
            {selectedColor ? t(`colors.${selectedColor.key}`) : value}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRESET_COLORS.map((color) => (
          <SelectItem key={color.value} value={color.value}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: color.value }}
              />
              {t(`colors.${color.key}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface CategoryRow {
  id: string
  name: string
  color: string
}

interface AnnouncementSettingsFormProps {
  categories: CategoryRow[]
}

function isGeneralCategory(category: CategoryRow) {
  return category.name.trim().toLowerCase() === 'general'
}

export function AnnouncementSettingsForm({ categories }: AnnouncementSettingsFormProps) {
  const t = useTranslations('announcements')
  const commonT = useTranslations('common')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editColor, setEditColor] = React.useState('')
  const [newColor, setNewColor] = React.useState(PRESET_COLORS[0].value)

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id)
    setEditColor(
      PRESET_COLORS.find((c) => c.value === cat.color) ? cat.color : PRESET_COLORS[0].value,
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('announcementCategories')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noCategories')}</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) =>
                editingId === cat.id ? (
                  <form
                    key={cat.id}
                    action={saveCategoryAction}
                    onSubmit={() => setEditingId(null)}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="hidden" name="color" value={editColor} />

                    <ColorSelect value={editColor} onValueChange={setEditColor} />

                    <Input
                      name="name"
                      defaultValue={cat.name}
                      maxLength={100}
                      required
                      className="flex-1 h-9"
                    />

                    <Button type="submit" size="sm">
                      {commonT('save')}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">{commonT('cancel')}</span>
                    </Button>
                  </form>
                ) : (
                  <div key={cat.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <div
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    {isGeneralCategory(cat) && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {commonT('default')}
                      </span>
                    )}

                    {!isGeneralCategory(cat) && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(cat)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">{commonT('edit')}</span>
                        </Button>

                        <form action={deleteCategoryAction}>
                          <input type="hidden" name="id" value={cat.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{commonT('delete')}</span>
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                ),
              )}
            </div>
          )}

          <form action={saveCategoryAction} className="pt-2">
            <input type="hidden" name="color" value={newColor} />
            <div className="flex items-end gap-2">
              <div className="grid gap-2">
                <Label>{t('color')}</Label>
                <ColorSelect value={newColor} onValueChange={setNewColor} />
              </div>

              <div className="flex-1 grid gap-2">
                <Label htmlFor="new-cat-name">{t('categoryName')}</Label>
                <Input
                  id="new-cat-name"
                  name="name"
                  maxLength={100}
                  placeholder={t('categoryNamePlaceholder')}
                  required
                />
              </div>

              <Button type="submit" className="self-end">
                {commonT('add')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
