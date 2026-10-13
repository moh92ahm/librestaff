import { describe, expect, it } from 'vitest'
import { getUserEditCapabilities } from '@/lib/user-edit-policy'

describe('user edit policy', () => {
  it('limits a non-admin editing their own profile to personal fields', () => {
    expect(
      getUserEditCapabilities({
        actorUserId: 'member-1',
        targetUserId: 'member-1',
        actorIsAdmin: false,
      }),
    ).toEqual({
      canEditAdministrativeFields: false,
      canEditRole: false,
    })
  })

  it('allows a scoped manager to maintain another user without assigning roles', () => {
    expect(
      getUserEditCapabilities({
        actorUserId: 'manager-1',
        targetUserId: 'member-1',
        actorIsAdmin: false,
      }),
    ).toEqual({
      canEditAdministrativeFields: true,
      canEditRole: false,
    })
  })

  it('allows an administrator to edit all fields, including their own', () => {
    expect(
      getUserEditCapabilities({
        actorUserId: 'admin-1',
        targetUserId: 'admin-1',
        actorIsAdmin: true,
      }),
    ).toEqual({
      canEditAdministrativeFields: true,
      canEditRole: true,
    })
  })
})
