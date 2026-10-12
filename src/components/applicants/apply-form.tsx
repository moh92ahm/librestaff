'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/date-picker'
import { MultiFileUpload, type MultiFileUploadValue } from '@/components/ui/multi-file-upload'
import { Loader2 } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

export function ApplyForm() {
  const t = useTranslations('publicApply')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    linkedInUrl: '',
    portfolioUrl: '',
    positionAppliedFor: '',
    yearsOfExperience: '',
    educationLevel: '',
    currentEmploymentStatus: '',
    expectedSalary: '',
    availabilityDate: '',
    source: '',
    bio: '',
    consentToDataStorage: false,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCvChange = (files: MultiFileUploadValue[]) => {
    const file = files.find((item): item is File => item instanceof File) || null

    if (!file) {
      setCvFile(null)
      return
    }

    if (file.type !== 'application/pdf') {
      notify.error(t('invalidFileType'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error(t('fileTooLarge'))
      return
    }

    setCvFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.consentToDataStorage) {
      notify.warning(t('consentRequired'))
      return
    }

    if (!cvFile) {
      notify.warning(t('cvRequired'))
      return
    }

    setIsSubmitting(true)

    try {
      // Submit everything to the apply endpoint in one request
      const submitFormData = new FormData()

      // Add all text fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          submitFormData.append(key, String(value))
        }
      })

      // Add CV file
      submitFormData.append('cv', cvFile)

      const response = await fetch('/api/apply', {
        method: 'POST',
        body: submitFormData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || t('submitFailed'))
      }

      notify.success(t('submitSuccess'))

      // Redirect to success page
      router.push('/apply/success')
    } catch (error) {
      console.error('Error submitting application:', error)
      notify.error(
        error instanceof Error
          ? error.message
          : t('submitFailed'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('formTitle')}</CardTitle>
          <CardDescription>
            {t('formDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('personalInformation')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  {t('fullName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder={t('fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('email')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder={t('emailPlaceholder')}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  {t('phoneNumber')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="+90 5xx xxx xx xx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedInUrl">{t('linkedInProfile')}</Label>
                <Input
                  id="linkedInUrl"
                  name="linkedInUrl"
                  type="url"
                  value={formData.linkedInUrl}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioUrl">{t('portfolioWebsite')}</Label>
              <Input
                id="portfolioUrl"
                name="portfolioUrl"
                type="url"
                value={formData.portfolioUrl}
                onChange={handleInputChange}
                placeholder="https://yourportfolio.com"
              />
            </div>
          </div>

          {/* Application Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('applicationDetails')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="positionAppliedFor">
                  {t('positionAppliedFor')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="positionAppliedFor"
                  name="positionAppliedFor"
                  value={formData.positionAppliedFor}
                  onChange={handleInputChange}
                  required
                  placeholder={t('positionPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearsOfExperience">
                  {t('yearsOfExperience')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="yearsOfExperience"
                  name="yearsOfExperience"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={formData.yearsOfExperience}
                  onChange={handleInputChange}
                  required
                  placeholder={t('experiencePlaceholder')}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="educationLevel">
                  {t('educationLevel')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.educationLevel}
                  onValueChange={(value) => handleSelectChange('educationLevel', value)}
                  required
                >
                  <SelectTrigger id="educationLevel">
                    <SelectValue placeholder={t('selectEducationLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high-school">{t('education.highSchool')}</SelectItem>
                    <SelectItem value="associate">{t('education.associate')}</SelectItem>
                    <SelectItem value="bachelor">{t('education.bachelor')}</SelectItem>
                    <SelectItem value="master">{t('education.master')}</SelectItem>
                    <SelectItem value="phd">{t('education.phd')}</SelectItem>
                    <SelectItem value="other">{t('education.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentEmploymentStatus">
                  {t('employmentStatus')} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.currentEmploymentStatus}
                  onValueChange={(value) => handleSelectChange('currentEmploymentStatus', value)}
                  required
                >
                  <SelectTrigger id="currentEmploymentStatus">
                    <SelectValue placeholder={t('selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">{t('employment.employed')}</SelectItem>
                    <SelectItem value="unemployed">{t('employment.unemployed')}</SelectItem>
                    <SelectItem value="notice-period">{t('employment.noticePeriod')}</SelectItem>
                    <SelectItem value="student">{t('employment.student')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
              <Label htmlFor="expectedSalary">{t('expectedSalary')}</Label>
                <Input
                  id="expectedSalary"
                  name="expectedSalary"
                  type="number"
                  min="0"
                  value={formData.expectedSalary}
                  onChange={handleInputChange}
                  placeholder="e.g., 50000"
                />
              </div>
              <div className="space-y-2">
                <DatePicker
                  name="availabilityDate"
                  label={t('availabilityDate')}
                  value={formData.availabilityDate}
                  onValueChange={(value) => handleSelectChange('availabilityDate', value)}
                  yearRange={{ from: new Date().getFullYear(), to: new Date().getFullYear() + 5 }}
                  allowPast={false}
                  clearable
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">{t('source')}</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => handleSelectChange('source', value)}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder={t('selectSource')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">{t('sources.website')}</SelectItem>
                  <SelectItem value="linkedin">{t('sources.linkedin')}</SelectItem>
                  <SelectItem value="referral">{t('sources.referral')}</SelectItem>
                  <SelectItem value="job-board">{t('sources.jobBoard')}</SelectItem>
                  <SelectItem value="other">{t('sources.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cover Letter */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('coverLetter')}</h3>
            <div className="space-y-2">
              <Label htmlFor="bio">
                {t('tellUsAboutYourself')} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                required
                rows={6}
                placeholder={t('bioPlaceholder')}
              />
            </div>
          </div>

          {/* CV Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('resumeCv')}</h3>
            <div className="space-y-2">
              <Label>
                {t('uploadCv')} <span className="text-red-500">*</span>
              </Label>
              <MultiFileUpload
                value={cvFile ? [cvFile] : []}
                onChange={handleCvChange}
                name="cv"
                label=""
                placeholder={t('uploadCvPlaceholder')}
                accept=".pdf"
                maxFiles={1}
                indexedNames={false}
              />
              <p className="text-xs text-muted-foreground">
                {t('fileHelp')}
              </p>
            </div>
          </div>

          {/* Consent */}
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="consentToDataStorage"
                checked={formData.consentToDataStorage}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, consentToDataStorage: checked as boolean }))
                }
                required
              />
              <div className="space-y-1">
                <Label
                  htmlFor="consentToDataStorage"
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('consent')} <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('consentDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submitApplication')
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
