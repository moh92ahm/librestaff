'use client'

import type { InferSelectModel } from 'drizzle-orm'
import { usersTable } from '@/db/schema'

type User = InferSelectModel<typeof usersTable> & {
  role?: { id: string; name: string; displayName?: string | null } | null
  department?: {
    id: string
    name: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    description: string | null
  } | null
}
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import Link from 'next/link'
import { DataTable } from '../data-table'
import { formatDate } from '@/lib/date-utils'
import { useLocale, useTranslations } from 'next-intl'

interface UserTableProps {
  data: User[]
  canEdit?: boolean
}

export function UserTable({ data, canEdit = true }: UserTableProps) {
  const t = useTranslations('users')
  const commonT = useTranslations('common')
  const employmentT = useTranslations('labels.employmentTypes')
  const roleT = useTranslations('users.roles')
  const locale = useLocale()
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  const columns = [
    {
      key: 'photo' as keyof User,
      header: t('image'),
      render: (photo: unknown, user: User) => {
        const photoUrl =
          typeof photo === 'object' && photo && 'url' in photo ? (photo as { url: string }).url : ''
        return (
          <Avatar className="h-12 w-12">
            <AvatarImage src={photoUrl} alt={user.fullName} className="object-cover" />
            <AvatarFallback className="text-md">{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
        )
      },
    },
    {
      key: 'fullName' as keyof User,
      header: t('fullName'),
    },
    {
      key: 'department' as keyof User,
      header: t('department'),
      render: (department: unknown) => {
        const deptName =
          typeof department === 'object' && department && 'name' in department
            ? (department as { name: string }).name
            : ''

        if (!deptName) {
          return <span className="text-muted-foreground">-</span>
        }
        return <Badge variant="outline">{deptName}</Badge>
      },
    },
    {
      key: 'role' as keyof User,
      header: t('access'),
      render: (role: unknown) => {
        const roleName =
          typeof role === 'object' && role && 'name' in role
            ? String((role as { name?: string }).name || '')
            : ''
        const displayName =
          typeof role === 'object' && role && 'displayName' in role
            ? String((role as { displayName?: string | null }).displayName || '')
            : ''
        const roleLabels = roleT.raw('labels') as Record<string, string>
        const roleLabel =
          roleName && roleName in roleLabels
            ? roleT(`labels.${roleName}`)
            : displayName || roleName || String(role || '')

        return roleLabel ? (
          <Badge variant="outline">{roleLabel}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      key: 'joinedAt' as keyof User,
      header: t('joinedAt'),
      render: (date: unknown) => {
        const isValidDate = date === null || typeof date === 'string' || date instanceof Date
        const dateString = date instanceof Date ? date.toISOString() : (date as string | null)
        return isValidDate ? formatDate(dateString, locale) : '-'
      },
    },
    {
      key: 'employmentType' as keyof User,
      header: t('employmentType'),
      render: (type: unknown) => (
        <Badge>{type ? employmentT(String(type) as any) || String(type) : '-'}</Badge>
      ),
    },
    {
      key: 'isActive' as keyof User,
      header: commonT('status'),
      render: (isActive: unknown) => (
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? commonT('active') : commonT('inactive')}
        </Badge>
      ),
    },
  ]

  const actionColumn = (user: User) => (
    <div className="flex gap-2">
      {canEdit && (
        <Link href={`/team-members/${user.id}/edit`}>
          <Button variant="outline" size="sm">
            {commonT('edit')}
          </Button>
        </Link>
      )}
      <Link href={`/team-members/${user.id}`}>
        <Button variant="secondary" size="sm">
          {commonT('view')}
        </Button>
      </Link>
    </div>
  )

  return <DataTable data={data} columns={columns} actionColumn={actionColumn} />
}
