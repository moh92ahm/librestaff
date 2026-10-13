import { beforeEach, describe, expect, it, vi } from 'vitest'

type SignupScenario = {
  hasExistingUser: boolean
  hasExistingUsername?: boolean
  invite?: {
    id: string
    email: string
    roleId: string
    expiresAt: string
    usedAt: string | null
  }
  inviteRole?: {
    id: string
    name: string
  }
}

function createMockDb({
  hasExistingUser,
  hasExistingUsername = false,
  invite,
  inviteRole,
}: SignupScenario) {
  const selectResults = [
    [],
    hasExistingUsername ? [{ id: 'existing-username' }] : [],
    hasExistingUser ? [{ id: 'existing-user' }] : [],
    [],
    [],
    ...(invite ? [[invite], [inviteRole || { id: invite.roleId, name: 'member' }]] : []),
  ]
  let insertedUser: Record<string, unknown> | null = null
  const updateWhere = vi.fn().mockResolvedValue(undefined)
  const updateSet = vi.fn(() => ({ where: updateWhere }))

  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResults.shift() || []),
        })),
        limit: vi.fn(async () => selectResults.shift() || []),
      })),
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          if ('email' in values) {
            insertedUser = values
            return [{ id: 'new-user', fullName: values.fullName, email: values.email }]
          }

          return [{ id: `role-${values.name}`, ...values }]
        }),
      })),
    })),
  }

  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
  }

  return { db, tx, getInsertedUser: () => insertedUser }
}

function signupRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'First User',
      email: 'first@example.com',
      username: 'firstuser',
      password: 'a-long-password-123',
      confirmPassword: 'a-long-password-123',
      primaryPhone: '+90 555 000 00 00',
      birthDate: '1990-01-01',
      joinedAt: '2026-06-10',
      setupSecret: 'test-setup-secret',
      ...overrides,
    }),
  })
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.SETUP_SECRET = 'test-setup-secret'
    vi.doMock('@/lib/rate-limit', () => ({
      consumeRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      getClientIp: vi.fn().mockReturnValue('test-client'),
      rateLimitResponse: vi.fn(),
    }))
  })

  it('assigns admin to the first user', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(signupRequest() as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.user.role).toBe('admin')
    expect(mockDb.getInsertedUser()).toMatchObject({
      email: 'first@example.com',
      password: 'hashed-password',
      roleId: 'role-admin',
    })
  })

  it('rejects an invalid secret for the first administrator', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ setupSecret: 'wrong-secret' }) as unknown as Parameters<typeof POST>[0],
    )

    expect(response.status).toBe(403)
    expect(mockDb.getInsertedUser()).toBeNull()
  })

  it('normalizes uppercase usernames before creating an account', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ username: 'JohnDOE' }) as unknown as Parameters<typeof POST>[0],
    )

    expect(response.status).toBe(201)
    expect(mockDb.getInsertedUser()).toMatchObject({
      username: 'johndoe',
    })
  })

  it('normalizes phone numbers before creating an account', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ primaryPhone: '90 555 111 22 33' }) as unknown as Parameters<typeof POST>[0],
    )

    expect(response.status).toBe(201)
    expect(mockDb.getInsertedUser()).toMatchObject({
      primaryPhone: '+905551112233',
    })
  })

  it('normalizes full names before creating an account', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ fullName: '  GÖRKEM   ALEL  ' }) as unknown as Parameters<typeof POST>[0],
    )

    expect(response.status).toBe(201)
    expect(mockDb.getInsertedUser()).toMatchObject({
      fullName: 'Görkem Alel',
    })
  })

  it('latin-normalizes accented usernames before creating an account', async () => {
    const mockDb = createMockDb({ hasExistingUser: false })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ username: 'ÇağrıKAYA' }) as unknown as Parameters<typeof POST>[0],
    )

    expect(response.status).toBe(201)
    expect(mockDb.getInsertedUser()).toMatchObject({
      username: 'cagrikaya',
    })
  })

  it('rejects username duplicates after lowercasing the submitted value', async () => {
    const mockDb = createMockDb({ hasExistingUser: false, hasExistingUsername: true })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ username: 'FirstUser' }) as unknown as Parameters<typeof POST>[0],
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({ error: 'An account with this username already exists' })
    expect(mockDb.getInsertedUser()).toBeNull()
  })

  it('rejects username duplicates after latin-normalizing the submitted value', async () => {
    const mockDb = createMockDb({ hasExistingUser: false, hasExistingUsername: true })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ username: 'ÇağrıKAYA' }) as unknown as Parameters<typeof POST>[0],
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({ error: 'An account with this username already exists' })
    expect(mockDb.getInsertedUser()).toBeNull()
  })

  it('rejects later users without an invite', async () => {
    const mockDb = createMockDb({ hasExistingUser: true })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(signupRequest() as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'A valid invite link is required to create an account' })
    expect(mockDb.getInsertedUser()).toBeNull()
  })

  it('uses and consumes a valid invite for later users', async () => {
    const mockDb = createMockDb({
      hasExistingUser: true,
      invite: {
        id: 'invite-1',
        email: 'first@example.com',
        roleId: 'role-member',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        usedAt: null,
      },
      inviteRole: { id: 'role-member', name: 'member' },
    })

    vi.doMock('@/db', () => ({ db: mockDb.db }))
    vi.doMock('bcryptjs', () => ({
      default: { hash: vi.fn().mockResolvedValue('hashed-password') },
    }))

    const { POST } = await import('@/app/api/signup/route')
    const response = await POST(
      signupRequest({ inviteToken: 'valid-token' }) as unknown as Parameters<typeof POST>[0],
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.user.role).toBe('member')
    expect(mockDb.getInsertedUser()).toMatchObject({
      roleId: 'role-member',
    })
    expect(mockDb.tx.update).toHaveBeenCalled()
  })
})
