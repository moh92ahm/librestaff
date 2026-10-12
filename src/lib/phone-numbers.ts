export function normalizePhoneNumber(value: unknown) {
  const normalized = String(value || '')
    .replace(/\s+/g, '')
    .replace(/\+/g, '')

  return normalized ? `+${normalized}` : ''
}
