import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('email settings encryption', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.EMAIL_SETTINGS_ENCRYPTION_KEY
  })

  it('encrypts and decrypts SMTP secrets without storing plaintext', async () => {
    process.env.EMAIL_SETTINGS_ENCRYPTION_KEY = '12345678901234567890123456789012'
    const { decryptSecret, encryptSecret, isEmailSettingsEncryptionConfigured } = await import(
      '@/lib/encryption'
    )

    const encrypted = encryptSecret('smtp-password')

    expect(isEmailSettingsEncryptionConfigured()).toBe(true)
    expect(encrypted).not.toContain('smtp-password')
    expect(decryptSecret(encrypted)).toBe('smtp-password')
  })

  it('requires a 32-byte encryption key', async () => {
    process.env.EMAIL_SETTINGS_ENCRYPTION_KEY = 'too-short'
    const { isEmailSettingsEncryptionConfigured, encryptSecret } = await import('@/lib/encryption')

    expect(isEmailSettingsEncryptionConfigured()).toBe(false)
    expect(() => encryptSecret('secret')).toThrow('EMAIL_SETTINGS_ENCRYPTION_KEY_INVALID')
  })
})
