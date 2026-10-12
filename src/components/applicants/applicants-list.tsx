'use client'

import * as React from 'react'
// import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
// import { ButtonGroup } from '@/components/ui/button-group'
import { Badge } from '@/components/ui/badge'
import { Filter, Share2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import type { InferSelectModel } from 'drizzle-orm'
import { applicantsTable, mediaTable } from '@/db/schema'
import { notify } from '@/lib/notify'
import { useTranslations } from 'next-intl'

type Applicant = InferSelectModel<typeof applicantsTable> & {
  cvFile?: InferSelectModel<typeof mediaTable> | null
}
import { ApplicantsTable } from './applicants-table'

interface ApplicantsListProps {
  data: Applicant[]
}

export function ApplicantsList({ data }: ApplicantsListProps) {
  const t = useTranslations('applicants')
  const commonT = useTranslations('common')
  const statusT = useTranslations('labels.statuses')
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])
  const [statusFilterOpen, setStatusFilterOpen] = React.useState(false)

  // Status options
  const statuses = [
    { value: 'new', label: statusT('new'), color: 'bg-blue-500' },
    { value: 'under-review', label: statusT('underReview'), color: 'bg-yellow-500' },
    { value: 'shortlisted', label: statusT('shortlisted'), color: 'bg-green-500' },
    { value: 'interview-scheduled', label: statusT('interviewScheduled'), color: 'bg-purple-500' },
    { value: 'rejected', label: statusT('rejected'), color: 'bg-red-500' },
    { value: 'hired', label: statusT('hired'), color: 'bg-emerald-500' },
  ]

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Helper functions for status filter
  const handleStatusToggle = (value: string) => {
    setStatusFilter((prev) =>
      prev.includes(value) ? prev.filter((status) => status !== value) : [...prev, value],
    )
  }

  const clearStatusFilter = () => {
    setStatusFilter([])
  }

  const getStatusLabel = (value: string) => {
    return statuses.find((s) => s.value === value)?.label || value
  }

  const handleShareApplyLink = async () => {
    const applyUrl = `${window.location.origin}/apply`

    try {
      if (navigator.share) {
        await navigator.share({
          title: t('shareTitle'),
          text: t('shareText'),
          url: applyUrl,
        })
        return
      }

      await navigator.clipboard.writeText(applyUrl)
      notify.success(t('applicationLinkCopied'))
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        notify.error(t('applicationLinkFailed'))
      }
    }
  }

  // Filter data
  const filtered = React.useMemo(() => {
    let result = data

    // Status filter
    if (statusFilter.length > 0) {
      result = result.filter((item) => statusFilter.includes(item.status))
    }

    // Search filter
    if (debounced) {
      const lowerQuery = debounced.toLowerCase()
      result = result.filter(
        (item) =>
          item.fullName?.toLowerCase().includes(lowerQuery) ||
          item.email?.toLowerCase().includes(lowerQuery) ||
          item.positionAppliedFor?.toLowerCase().includes(lowerQuery) ||
          item.phone?.toLowerCase().includes(lowerQuery),
      )
    }

    return result
  }, [data, statusFilter, debounced])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('manageDescription', { shown: filtered.length, total: data.length })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="flex-1">
          <Input
            placeholder={t('search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="flex gap-2">
          {/* Status Filter */}
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {commonT('status')}
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{t('filterByStatus')}</h4>
                  {statusFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearStatusFilter}
                      className="h-auto p-0 text-xs"
                    >
                      {commonT('clear')}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {statuses.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={statusFilter.includes(status.value)}
                        onCheckedChange={() => handleStatusToggle(status.value)}
                      />
                      <label
                        htmlFor={`status-${status.value}`}
                        className="flex flex-1 items-center gap-2 text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <span className={`h-2 w-2 rounded-full ${status.color}`} />
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" className="gap-2" onClick={handleShareApplyLink}>
            <Share2 className="h-4 w-4" />
            {t('share')}
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {statusFilter.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('activeFilters')}</span>
          {statusFilter.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {getStatusLabel(status)}
              <button
                onClick={() => handleStatusToggle(status)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Table */}
      <ApplicantsTable data={filtered} />
    </div>
  )
}
