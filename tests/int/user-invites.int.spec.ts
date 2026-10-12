import { beforeEach, describe, expect, it, vi } from 'vitest'

function inviteRequest() {
  return new Request('http://localhost:3000/api/user-invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new.user@example.com',
      roleId: 'role-member',
    }),
  })
}

function createMockDb() {
  const emailSettings = {
    id: 'default',
    enabled: true,
    fromName: 'LibreStaff',
    fromEmail: 'noreply@example.com',
    replyToEmail: null,
    smtpHost: 'smtp-relay.gmail.com',
    smtpPort: 587,
    secureMode: 'starttls',
    authMode: 'none',
    encryptedSmtpUsername: null,
    encryptedSmtpPassword: null,
    lastTestAt: '2026-06-11T00:00:00.000Z',
    lastTestStatus: 'success',
    lastTestError: null,
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  }
  const selectResults = [
    [emailSettings],
    [],
    [{ id: 'role-member', name: 'member', displayName: 'Member' }],
    [],
    [emailSettings],
  ]
  let insertedInvite: Record<string, unknown> | null = null

  const where = vi.fn(() => {
    const result = selectResults.shift() || []
    return {
      limit: vi.fn(async () => result),
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
    }
  })
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  const insert = vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => {
      insertedInvite = values
      return {
        returning: vi.fn(async () => [{ id: 'invite-1' }]),
      }
    }),
  }))

  return { db: { select, insert }, getInsertedInvite: () => insertedInvite }
}

describe('POST /api/user-invites', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.NEXTAUTH_URL
  })

  it('requires admin access', async () => {
    vi.doMock('@/lib/auth-guards', () => ({
      requireAdminAPI: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/db', () => ({
      db: {},
    }))

    const { POST } = await import('@/app/api/user-invites/route')
    const response = await POST(inviteRequest() as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ error: 'Admin access required' })
  })

  it('fails clearly when email is not configured', async () => {
    vi.doMock('@/lib/auth-guards', () => ({
      requireAdminAPI: vi.fn().mockResolvedValue({ id: 'admin-1' }),
    }))
    vi.doMock('@/db', () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      },
    }))

    const { POST } = await import('@/app/api/user-invites/route')
    const response = await POST(inviteRequest() as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: 'Email settings are not configured',
    })
  })

  it('creates an email-locked invite and sends it through DB-backed SMTP settings', async () => {
    process.env.NEXTAUTH_URL = 'https://team.example.com'
    const mockDb = createMockDb()
    const sendMail = vi.fn().mockResolvedValue(undefined)
    const createTransport = vi.fn(() => ({ sendMail }))

    vi.doMock('nodemailer', () => ({
      default: { createTransport },
    }))
    vi.doMock('@/lib/auth-guards', () => ({
      requireAdminAPI: vi.fn().mockResolvedValue({ id: 'admin-1' }),
    }))
    vi.doMock('@/lib/company-settings', () => ({
      getCompanyBranding: vi.fn().mockResolvedValue({
        companyName: 'Acme Health',
        logoUrl: '/media/acme-logo.png',
      }),
    }))
    vi.doMock('@/db', () => ({
      db: mockDb.db,
    }))

    const { POST } = await import('@/app/api/user-invites/route')
    const response = await POST(inviteRequest() as unknown as Parameters<typeof POST>[0])
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.invite).toMatchObject({
      email: 'new.user@example.com',
      role: 'Member',
      emailSent: true,
    })
    expect(body.invite.inviteUrl).toContain('/signup?token=')
    expect(mockDb.getInsertedInvite()).toMatchObject({
      email: 'new.user@example.com',
      roleId: 'role-member',
      invitedBy: 'admin-1',
    })
    expect(mockDb.getInsertedInvite()).not.toHaveProperty('token')
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp-relay.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
      }),
    )
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"LibreStaff" <noreply@example.com>',
        to: 'new.user@example.com',
        subject: 'You have been invited to Acme Health',
      }),
    )
  })
})
