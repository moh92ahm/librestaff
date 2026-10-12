import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const ENCODING_VERSION = 'v1'

function getEncryptionKey() {
  const raw = process.env.EMAIL_SETTINGS_ENCRYPTION_KEY

  if (!raw) {
    throw new Error('EMAIL_SETTINGS_ENCRYPTION_KEY_MISSING')
  }

  const trimmed = raw.trim()
  const key =
    /^[a-f0-9]{64}$/i.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : /^[A-Za-z0-9+/=]{43,44}$/.test(trimmed)
        ? Buffer.from(trimmed, 'base64')
        : Buffer.from(trimmed, 'utf8')

  if (key.length !== 32) {
    throw new Error('EMAIL_SETTINGS_ENCRYPTION_KEY_INVALID')
  }

  return key
}

export function isEmailSettingsEncryptionConfigured() {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    ENCODING_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptSecret(value: string) {
  const [version, ivRaw, authTagRaw, encryptedRaw] = value.split(':')

  if (version !== ENCODING_VERSION || !ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error('ENCRYPTED_SECRET_INVALID')
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivRaw, 'base64url'), {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
