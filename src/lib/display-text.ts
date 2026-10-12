const TURKISH_CHARACTER_PATTERN = /[İıĞğÜüŞşÖöÇç]/
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu

function titleCaseWord(word: string) {
  if (!word) return word

  const locale = TURKISH_CHARACTER_PATTERN.test(word) ? 'tr' : undefined
  const lower = locale ? word.toLocaleLowerCase(locale) : word.toLocaleLowerCase()
  const [first = '', ...rest] = Array.from(lower)

  return `${locale ? first.toLocaleUpperCase(locale) : first.toLocaleUpperCase()}${rest.join('')}`
}

export function normalizeDisplayText(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(WORD_PATTERN, (word) => titleCaseWord(word))
}

export function normalizeDisplayTextInput(value: unknown) {
  const raw = String(value || '')
  const normalized = normalizeDisplayText(raw)

  return /\s$/.test(raw) && normalized ? `${normalized} ` : normalized
}
