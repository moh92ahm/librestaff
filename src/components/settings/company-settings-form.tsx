'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePhotoUpload } from '@/components/ui/profile-photo-upload'
import { Save } from 'lucide-react'
import type { InferSelectModel } from 'drizzle-orm'
import { companySettingsTable } from '@/db/schema'
import { HolidayCountryPicker } from '@/components/settings/holiday-country-picker'
import { AppLanguagePicker } from '@/components/settings/app-language-picker'
import type { HolidayCountryOption } from '@/lib/holiday-utils'
import { notify } from '@/lib/notify'
import { TimezoneSelect } from '@/components/ui/timezone-select'
import { useTranslations } from 'next-intl'

type CompanySettings = InferSelectModel<typeof companySettingsTable>

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

export function CompanySettingsForm({
  settings,
  action,
  holidayCountryOptions,
}: {
  settings: CompanySettings
  action: (formData: FormData) => Promise<void>
  holidayCountryOptions: HolidayCountryOption[]
}) {
  const t = useTranslations('companySettings')
  const settingsT = useTranslations('settings')
  const weekdaysT = useTranslations('labels.weekdays')
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [defaultTimezone, setDefaultTimezone] = React.useState(settings.defaultTimezone)
  const workingWeek = new Set(settings.workingWeek || [])

  const formAction = async (formData: FormData) => {
    try {
      await action(formData)
      notify.success(settingsT('companySettingsSaved'))
    } catch (error) {
      notify.error(error, settingsT('companySettingsFailed'))
    }
  }

  return (
    <form action={formAction} className="w-full space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{settingsT('companyTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {settingsT('companyDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{settingsT('branding')}</CardTitle>
          <CardDescription>{settingsT('brandingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="space-y-4">
            <ProfilePhotoUpload
              name="logo"
              value={logoFile || settings.logoUrl}
              onChange={setLogoFile}
              placeholder={settingsT('companyLogo')}
              size="xl"
            />
            <div className="flex items-center gap-2 rounded-md border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.logoUrl || '/brand/LibreStaff-Logo.png'}
                alt={settings.companyName}
                width={32}
                height={32}
                className="rounded-sm object-contain"
              />
              <span className="text-sm text-muted-foreground">{settingsT('currentLogo')}</span>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">{settingsT('companyName')}</Label>
              <Input
                id="companyName"
                name="companyName"
                defaultValue={settings.companyName}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">{settingsT('logoUrl')}</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                defaultValue={settings.logoUrl}
                placeholder="/brand/LibreStaff-Logo.png"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">{settingsT('website')}</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={settings.website || ''}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{settingsT('companyProfile')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="companyEmail">{settingsT('companyEmail')}</Label>
            <Input
              id="companyEmail"
              name="companyEmail"
              type="email"
              defaultValue={settings.companyEmail || ''}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">{settingsT('phone')}</Label>
            <Input id="phone" name="phone" defaultValue={settings.phone || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">{settingsT('country')}</Label>
            <Input id="country" name="country" defaultValue={settings.country || ''} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="taxRegistrationNumber">{settingsT('taxRegistrationNumber')}</Label>
            <Input
              id="taxRegistrationNumber"
              name="taxRegistrationNumber"
              defaultValue={settings.taxRegistrationNumber || ''}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="address">{settingsT('address')}</Label>
            <Textarea id="address" name="address" defaultValue={settings.address || ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{settingsT('regionalDefaults')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="defaultTimezone">{settingsT('defaultTimezone')}</Label>
            <input type="hidden" name="defaultTimezone" value={defaultTimezone} />
            <TimezoneSelect
              id="defaultTimezone"
              value={defaultTimezone}
              onValueChange={setDefaultTimezone}
            />
          </div>
          <div className="grid gap-3">
            <Label>{settingsT('workingWeek')}</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {weekdays.map((day) => (
                <label key={day} className="flex items-center gap-2 rounded-md border p-3">
                  <input
                    type="checkbox"
                    name="workingWeek"
                    value={day}
                    defaultChecked={workingWeek.has(day)}
                    className="size-4 rounded border-input"
                  />
                  <span className="text-sm">{weekdaysT(day)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <Label>{settingsT('holidayCalendars')}</Label>
            <HolidayCountryPicker
              name="holidayCountries"
              options={holidayCountryOptions}
              defaultValue={settings.holidayCountries || []}
            />
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>{t('appLanguages')}</Label>
              <p className="text-sm text-muted-foreground">{t('appLanguagesDescription')}</p>
            </div>
            <AppLanguagePicker
              name="enabledLanguages"
              defaultValue={settings.enabledLanguages || ['en']}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {settingsT('saveCompanySettings')}
        </Button>
      </div>
    </form>
  )
}
