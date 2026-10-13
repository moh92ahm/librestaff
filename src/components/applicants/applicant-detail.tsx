'use client'

import * as React from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Mail,
  Phone,
  Linkedin,
  Globe,
  GraduationCap,
  Briefcase,
  UserCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'
import type { InferSelectModel } from 'drizzle-orm'
import { applicantsTable, mediaTable } from '@/db/schema'

type Applicant = InferSelectModel<typeof applicantsTable> & {
  cvFile?: InferSelectModel<typeof mediaTable> | null
}
import { SetBreadcrumbLabel } from '@/components/set-breadcrumb-label'

interface ApplicantDetailProps {
  applicant: Applicant
}

const statusConfig: Record<string, { icon: string }> = {
  new: { icon: '🆕' },
  'under-review': { icon: '👀' },
  shortlisted: { icon: '⭐' },
  'interview-scheduled': { icon: '📅' },
  rejected: { icon: '❌' },
  hired: { icon: '✅' },
}

export function ApplicantDetail({ applicant }: ApplicantDetailProps) {
  const t = useTranslations('applicants')
  const common = useTranslations('common')
  const enumT = useTranslations('enums')
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [status, setStatus] = useState(applicant.status)
  const [internalNotes, setInternalNotes] = useState('')

  // Use any type for extended properties until types are regenerated
  const app = applicant as any

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/applicants/${applicant.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, internalNotes }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t('statusUpdateFailed'))
      }

      setStatus(newStatus as any)
      notify.success(t('statusUpdated'))
      router.refresh()
    } catch (error) {
      console.error('Error updating status:', error)
      notify.error(error, t('statusUpdateFailed'))
    } finally {
      setIsUpdating(false)
    }
  }

  const cvUrl =
    applicant.cvFile?.url ||
    (typeof applicant.cv === 'object' && applicant.cv && 'url' in applicant.cv
      ? (applicant.cv as { url: string }).url
      : typeof applicant.cv === 'string' && applicant.cv.startsWith('/')
        ? applicant.cv
        : '')

  const departmentName =
    app.department && typeof app.department === 'object' && 'name' in app.department
      ? app.department.name
      : null

  const reviewedByName =
    app.reviewedBy && typeof app.reviewedBy === 'object' && 'fullName' in app.reviewedBy
      ? app.reviewedBy.fullName
      : null

  const translatedEnum = (group: string, value: string | null | undefined) => {
    if (!value) return ''
    try {
      return enumT(`${group}.${value}` as any)
    } catch {
      return value
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <SetBreadcrumbLabel label={applicant.fullName} />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/applicants">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {common('back')}
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{t('detailsTitle')}</h1>
            </div>
          </div>
          <Link href={`/team-members/new`}>
            <Button variant="outline" size="sm">
              {t('changeToTeamMember')}
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Content - 2 columns */}
          <div className="md:col-span-2 space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('contactInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold">{applicant.fullName}</h1>
                  <p className="text-sm text-muted-foreground">{applicant.positionAppliedFor}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">
                        {t('email')}:{' '}
                        <a
                          href={`mailto:${applicant.email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {applicant.email}
                        </a>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">
                        {t('phone')}:{' '}
                        <a
                          href={`tel:${applicant.phone}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {applicant.phone}
                        </a>
                      </span>
                    </div>
                  </div>
                </div>

                {(app.linkedInUrl || app.portfolioUrl) && (
                  <>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-2">
                      {app.linkedInUrl && (
                        <div className="flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">LinkedIn</p>
                            <a
                              href={app.linkedInUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              {t('viewProfile')}
                            </a>
                          </div>
                        </div>
                      )}
                      {app.portfolioUrl && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{t('portfolio')}</p>
                            <a
                              href={app.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              {t('viewWebsite')}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Professional Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('professionalInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('positionAppliedFor')}
                    </p>
                    <p className="text-sm font-semibold">{applicant.positionAppliedFor}</p>
                  </div>
                  {departmentName && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('department')}</p>
                      <Badge variant="outline">{departmentName}</Badge>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('experience')}</p>
                      <p className="text-sm font-semibold">
                        {applicant.yearsOfExperience}{' '}
                        {t('years', { count: applicant.yearsOfExperience })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('education')}</p>
                      <p className="text-sm font-semibold">
                        {translatedEnum('education', applicant.educationLevel)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {common('status')}
                      </p>
                      <p className="text-sm font-semibold">
                        {translatedEnum('employmentStatus', applicant.currentEmploymentStatus)}
                      </p>
                    </div>
                  </div>
                </div>

                {app.expectedSalary && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('expectedMonthlySalary')}
                      </p>
                      <p className="text-sm font-semibold">
                        ₺{app.expectedSalary.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}

                {app.availabilityDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('availableFrom')}
                    </p>
                    <p className="text-sm font-semibold">{formatDate(app.availabilityDate)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            {app.skills && Array.isArray(app.skills) && app.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('skills')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {app.skills.map((skillItem: any, index: number) => {
                      const skillText =
                        typeof skillItem === 'object' && 'skill' in skillItem
                          ? skillItem.skill
                          : String(skillItem)
                      return (
                        <Badge key={index} variant="secondary">
                          {skillText}
                        </Badge>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cover Letter / Bio */}
            <Card>
              <CardHeader>
                <CardTitle>{t('coverLetter')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{applicant.bio}</p>
              </CardContent>
            </Card>

            {/* CV Document */}
            <Card>
              <CardHeader>
                <CardTitle>{t('resumeCv')}</CardTitle>
              </CardHeader>
              <CardContent>
                {cvUrl ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{t('cvDocument')}</p>
                        <p className="text-sm text-muted-foreground">{t('cvHelp')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                          {common('view')}
                        </a>
                      </Button>
                      <Button asChild variant="default" size="sm">
                        <a href={cvUrl} download>
                          <Download className="h-4 w-4 mr-2" />
                          {t('download')}
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('noCvUploaded')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle>{t('applicationStatus')}</CardTitle>
                <CardDescription>{t('updateStatus')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">{common('status')}</Label>
                  <Select value={status} onValueChange={handleStatusChange} disabled={isUpdating}>
                    <SelectTrigger id="status">
                      <SelectValue>
                        {isUpdating ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('updating')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            {statusConfig[status]?.icon} {translatedEnum('applicantStatus', status)}
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          <span className="flex items-center gap-2">
                            {config.icon} {translatedEnum('applicantStatus', value)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t('internalNotes')}</Label>
                  <Textarea
                    id="notes"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">{t('notesHelp')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Application Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t('applicationDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('appliedOn')}</p>
                  <p className="font-medium">{formatDate(applicant.applicationDate)}</p>
                </div>
                {applicant.source && (
                  <div>
                    <p className="text-muted-foreground">{t('source')}</p>
                    <p className="font-medium">{translatedEnum('source', applicant.source)}</p>
                  </div>
                )}
                {reviewedByName && app.reviewedAt && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">{t('reviewedBy')}</p>
                      <p className="font-medium">{reviewedByName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('reviewedOn')}</p>
                      <p className="font-medium">{formatDate(app.reviewedAt)}</p>
                    </div>
                  </>
                )}
                {app.converted && (
                  <>
                    <Separator />
                    <div>
                      <Badge variant="default" className="w-full justify-center">
                        {t('convertedToUser')}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
