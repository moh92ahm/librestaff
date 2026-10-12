import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('root department helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('identifies Organization as the root department name', async () => {
    const { isRootDepartmentName, ROOT_DEPARTMENT_NAME } = await import('@/lib/root-department')

    expect(ROOT_DEPARTMENT_NAME).toBe('Organization')
    expect(isRootDepartmentName('Organization')).toBe(true)
    expect(isRootDepartmentName(' organization ')).toBe(true)
    expect(isRootDepartmentName('Engineering')).toBe(false)
  })

  it('lets the Organization manager manage all active departments', async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ departmentId: 'dept-root', name: 'Organization' }])
      .mockResolvedValueOnce([
        { departmentId: 'dept-root' },
        { departmentId: 'dept-engineering' },
        { departmentId: 'dept-finance' },
      ])
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))

    vi.doMock('@/db', () => ({
      db: {
        select,
      },
    }))

    const { getManagedDepartmentIds } = await import('@/lib/manager-permissions')

    await expect(getManagedDepartmentIds('user-root-manager')).resolves.toEqual([
      'dept-root',
      'dept-engineering',
      'dept-finance',
    ])
  })
})
