import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/users/options', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns users as select options', async () => {
    const orderBy = vi.fn().mockResolvedValue([
      { id: 'user-1', fullName: 'Ada Lovelace', email: 'ada@example.com' },
      { id: 'user-2', fullName: 'Grace Hopper', email: 'grace@example.com' },
    ])
    const where = vi.fn(() => ({ orderBy }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))

    vi.doMock('@/db', () => ({
      db: { select },
    }))
    vi.doMock('@/lib/auth-guards', () => ({
      requireAuthAPI: vi.fn().mockResolvedValue({ id: 'admin-1' }),
      successResponse: (data: unknown, status = 200) => Response.json(data, { status }),
      unauthorizedResponse: (message = 'Unauthorized') =>
        Response.json({ error: message }, { status: 401 }),
      errorResponse: (message: string, status = 400) =>
        Response.json({ error: message }, { status }),
    }))

    const { GET } = await import('@/app/api/users/options/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      options: [
        { value: 'user-1', label: 'Ada Lovelace' },
        { value: 'user-2', label: 'Grace Hopper' },
      ],
    })
  })

  it('rejects unauthenticated requests', async () => {
    vi.doMock('@/db', () => ({
      db: { select: vi.fn() },
    }))
    vi.doMock('@/lib/auth-guards', () => ({
      requireAuthAPI: vi.fn().mockResolvedValue(null),
      successResponse: (data: unknown, status = 200) => Response.json(data, { status }),
      unauthorizedResponse: (message = 'Unauthorized') =>
        Response.json({ error: message }, { status: 401 }),
      errorResponse: (message: string, status = 400) =>
        Response.json({ error: message }, { status }),
    }))

    const { GET } = await import('@/app/api/users/options/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })
})
