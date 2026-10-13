import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('security hardening', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects cron query-string secrets and accepts bearer secrets', async () => {
    process.env.CRON_SECRET = 'cron-secret'
    const generateDueExpensePayments = vi.fn().mockResolvedValue([])
    vi.doMock('@/lib/expense-generation', () => ({ generateDueExpensePayments }))

    const { GET } = await import('@/app/api/jobs/expense-payments/route')

    const queryRequest = new Request(
      'http://localhost:3000/api/jobs/expense-payments?secret=cron-secret',
    )
    const queryResponse = await GET(
      Object.assign(queryRequest, { nextUrl: new URL(queryRequest.url) }) as any,
    )
    expect(queryResponse.status).toBe(401)
    expect(generateDueExpensePayments).not.toHaveBeenCalled()

    const bearerRequest = new Request('http://localhost:3000/api/jobs/expense-payments', {
      headers: { authorization: 'Bearer cron-secret' },
    })
    const bearerResponse = await GET(
      Object.assign(bearerRequest, { nextUrl: new URL(bearerRequest.url) }) as any,
    )
    expect(bearerResponse.status).toBe(200)
    expect(generateDueExpensePayments).toHaveBeenCalledTimes(1)
  })

  it('requires scoped employee edit access before document upload', async () => {
    const requirePermissionAPI = vi.fn().mockResolvedValue(null)
    vi.doMock('@/lib/permissions', () => ({
      requirePermissionAPI,
      canAccessTargetUser: vi.fn(),
    }))
    vi.doMock('@/db', () => ({ db: {} }))

    const { POST } = await import('@/app/api/users/[id]/documents/route')
    const response = await POST(
      new Request('http://localhost:3000/api/users/u1/documents') as any,
      {
        params: Promise.resolve({ id: 'u1' }),
      },
    )

    expect(response.status).toBe(403)
    expect(requirePermissionAPI).toHaveBeenCalledWith('employees', 'edit')
  })

  it('rejects document upload when actor cannot edit the target user', async () => {
    vi.doMock('@/lib/permissions', () => ({
      requirePermissionAPI: vi.fn().mockResolvedValue({ id: 'actor' }),
      canAccessTargetUser: vi.fn().mockResolvedValue(false),
    }))
    vi.doMock('@/db', () => ({ db: {} }))

    const { POST } = await import('@/app/api/users/[id]/documents/route')
    const response = await POST(
      new Request('http://localhost:3000/api/users/u2/documents') as any,
      {
        params: Promise.resolve({ id: 'u2' }),
      },
    )

    expect(response.status).toBe(403)
  })

  it('does not allow generic media deletion by ID', async () => {
    vi.doMock('@/lib/auth', () => ({ getServerSession: vi.fn() }))
    vi.doMock('@/lib/media-storage', () => ({
      documentMimeTypes: [],
      imageMimeTypes: [],
      saveUploadedMedia: vi.fn(),
    }))
    vi.doMock('@/lib/permissions', () => ({ hasPermission: vi.fn() }))
    vi.doMock('@/lib/rate-limit', () => ({
      consumeRateLimit: vi.fn(),
      getClientIp: vi.fn(),
      rateLimitResponse: vi.fn(),
    }))

    const { DELETE } = await import('@/app/api/upload/route')
    const response = await DELETE(
      new Request('http://localhost:3000/api/upload?id=someone-elses-file') as any,
    )

    expect(response.status).toBe(405)
    await expect(response.json()).resolves.toEqual({
      error: 'Delete media through its owning resource.',
    })
  })
})
