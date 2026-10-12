import { describe, expect, it } from 'vitest'
import {
  getPermissionActionsForResource,
  groupPermissionRows,
  normalizePermissionRows,
} from '@/lib/role-permissions'

describe('role permission utilities', () => {
  it('limits announcement actions to channel administration actions', () => {
    expect(getPermissionActionsForResource('announcements')).toEqual(['create', 'edit', 'delete'])
  })

  it('filters obsolete announcement view and approve permissions', () => {
    expect(
      normalizePermissionRows([
        {
          resource: 'announcements',
          actions: ['view', 'create', 'approve', 'delete'],
          scope: 'all',
        },
      ]),
    ).toEqual([
      { resource: 'announcements', action: 'create', scope: 'all' },
      { resource: 'announcements', action: 'delete', scope: 'all' },
    ])

    expect(
      groupPermissionRows([
        { resource: 'announcements', action: 'view', scope: 'all' },
        { resource: 'announcements', action: 'edit', scope: 'all' },
        { resource: 'announcements', action: 'approve', scope: 'all' },
      ]),
    ).toEqual([{ resource: 'announcements', actions: ['edit'], scope: 'all' }])
  })
})
