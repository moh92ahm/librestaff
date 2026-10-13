import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  getClientIp: vi.fn().mockReturnValue('test-client'),
  rateLimitResponse: vi.fn(),
}))

describe('POST /api/apply', () => {
  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/librestaff_test'
  })

  async function postApply(formData: FormData) {
    const { POST } = await import('@/app/api/apply/route')
    const request = new Request('http://localhost:3000/api/apply', {
      method: 'POST',
      body: formData,
    })

    return POST(request as any)
  }

  it('rejects submissions with missing required fields', async () => {
    const response = await postApply(new FormData())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      success: false,
      message: 'Missing required fields',
    })
  })

  it('rejects submissions with an invalid email address', async () => {
    const formData = new FormData()
    formData.set('fullName', 'Test Applicant')
    formData.set('email', 'not-an-email')
    formData.set('phone', '+90 555 000 00 00')
    formData.set('positionAppliedFor', 'Software Engineer')
    formData.set('yearsOfExperience', '3')
    formData.set('educationLevel', 'bachelor')
    formData.set('currentEmploymentStatus', 'employed')
    formData.set('bio', 'I am interested in this role.')
    formData.set('consentToDataStorage', 'true')
    formData.set('cv', 'present')

    const response = await postApply(formData)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({
      success: false,
      message: 'Invalid email format',
    })
  })

  it('rejects unsafe portfolio URL schemes', async () => {
    const formData = new FormData()
    formData.set('fullName', 'Test Applicant')
    formData.set('email', 'test@example.com')
    formData.set('phone', '+90 555 000 00 00')
    formData.set('portfolioUrl', 'javascript:alert(1)')
    formData.set('positionAppliedFor', 'Software Engineer')
    formData.set('yearsOfExperience', '3')
    formData.set('educationLevel', 'bachelor')
    formData.set('currentEmploymentStatus', 'employed')
    formData.set('bio', 'I am interested in this role.')
    formData.set('consentToDataStorage', 'true')
    formData.set('cv', 'validation-does-not-reach-file-upload')

    const response = await postApply(formData)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: 'URLs must use http or https',
    })
  })

  it('rejects unreasonable numeric values', async () => {
    const formData = new FormData()
    formData.set('fullName', 'Test Applicant')
    formData.set('email', 'test@example.com')
    formData.set('phone', '+90 555 000 00 00')
    formData.set('positionAppliedFor', 'Software Engineer')
    formData.set('yearsOfExperience', '999')
    formData.set('educationLevel', 'bachelor')
    formData.set('currentEmploymentStatus', 'employed')
    formData.set('bio', 'I am interested in this role.')
    formData.set('consentToDataStorage', 'true')
    formData.set('cv', 'validation-does-not-reach-file-upload')

    const response = await postApply(formData)
    expect(response.status).toBe(400)
  })
})
