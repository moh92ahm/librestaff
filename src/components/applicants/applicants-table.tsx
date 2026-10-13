'use client'

import type { InferSelectModel } from 'drizzle-orm'
import { applicantsTable, mediaTable } from '@/db/schema'

type Applicant = InferSelectModel<typeof applicantsTable> & {
  cvFile?: InferSelectModel<typeof mediaTable> | null
}
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import Link from 'next/link'
import { DataTable } from '../data-table'
import { formatDate } from '@/lib/date-utils'
import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ApplicantsTableProps {
  data: Applicant[]
}

export function ApplicantsTable({ data }: ApplicantsTableProps) {
  const t = useTranslations('applicants')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const educationT = useTranslations('publicApply.education')
  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    new: 'default',
    'under-review': 'secondary',
    shortlisted: 'outline',
    'interview-scheduled': 'secondary',
    rejected: 'destructive',
    hired: 'default',
  }
  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      new: statusT('new'),
      'under-review': statusT('underReview'),
      shortlisted: statusT('shortlisted'),
      'interview-scheduled': statusT('interviewScheduled'),
      rejected: statusT('rejected'),
      hired: statusT('hired'),
    }
    return map[status] || status
  }
  const getEducationLabel = (level: string) => {
    const map: Record<string, string> = {
      'high-school': educationT('highSchool'),
      associate: educationT('associate'),
      bachelor: educationT('bachelor'),
      master: educationT('master'),
      phd: educationT('phd'),
      other: educationT('other'),
    }
    return map[level] || level
  }
  const columns = [
    {
      key: 'fullName' as keyof Applicant,
      header: t('fullName'),
      render: (value: unknown, applicant: Applicant) => (
        <Link href={`/applicants/${applicant.id}`} className="font-medium hover:underline">
          {String(value)}
        </Link>
      ),
    },
    {
      key: 'email' as keyof Applicant,
      header: t('email'),
      render: (value: unknown) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      key: 'phone' as keyof Applicant,
      header: t('phone'),
      render: (value: unknown) => (
        <span className="text-sm text-muted-foreground">{String(value || '-')}</span>
      ),
    },
    {
      key: 'positionAppliedFor' as keyof Applicant,
      header: t('position'),
      render: (value: unknown) => <span className="font-medium">{String(value)}</span>,
    },
    {
      key: 'yearsOfExperience' as keyof Applicant,
      header: t('experience'),
      render: (value: unknown) => {
        const years = Number(value) || 0
        return (
          <span className="text-sm">
            {years} {t('years', { count: years })}
          </span>
        )
      },
    },
    {
      key: 'educationLevel' as keyof Applicant,
      header: t('education'),
      render: (value: unknown) => {
        const level = String(value)
        return (
          <Badge variant="outline" className="text-xs">
            {getEducationLabel(level)}
          </Badge>
        )
      },
    },
    {
      key: 'status' as keyof Applicant,
      header: commonT('status'),
      render: (value: unknown) => {
        const status = String(value)
        return <Badge variant={statusVariant[status] || 'outline'}>{getStatusLabel(status)}</Badge>
      },
    },
    {
      key: 'applicationDate' as keyof Applicant,
      header: t('appliedOn'),
      render: (value: unknown) => {
        if (!value) return <span className="text-muted-foreground">-</span>
        return <span className="text-sm text-muted-foreground">{formatDate(String(value))}</span>
      },
    },
    {
      key: 'cv' as keyof Applicant,
      header: 'CV',
      render: (cv: unknown, applicant: Applicant) => {
        const cvUrl =
          applicant.cvFile?.url ||
          (typeof cv === 'object' && cv && 'url' in cv
            ? (cv as { url: string }).url
            : typeof cv === 'string' && cv.startsWith('/')
              ? cv
              : '')
        if (!cvUrl) return <span className="text-muted-foreground">-</span>
        return (
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            {commonT('view')}
          </a>
        )
      },
    },
    {
      key: 'id' as keyof Applicant,
      header: commonT('actions'),
      render: (value: unknown) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/applicants/${value}`}>{t('viewDetails')}</Link>
        </Button>
      ),
    },
  ]

  return (
    <div>
      <DataTable data={data} columns={columns} />
    </div>
  )
}
