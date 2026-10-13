import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('rate-limit security behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.TRUST_PROXY_HEADERS
  })

  it('ignores spoofable forwarding headers unless proxy trust is enabled', async () => {
    vi.doMock('@/db', () => ({ db: {} }))
    const { getClientIp } = await import('@/lib/rate-limit')
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.20, 203.0.113.10',
      },
    })

    expect(getClientIp(request)).toBe('unknown')
    process.env.TRUST_PROXY_HEADERS = 'true'
    expect(getClientIp(request)).toBe('203.0.113.10')
  })

  it('fails closed when the rate-limit store is unavailable', async () => {
    vi.doMock('@/db', () => ({
      db: {
        insert: vi.fn(() => {
          throw new Error('database unavailable')
        }),
      },
    }))

    const { consumeRateLimit } = await import('@/lib/rate-limit')
    const result = await consumeRateLimit({
      scope: 'login',
      key: 'test',
      limit: 5,
      windowMs: 60_000,
    })

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
