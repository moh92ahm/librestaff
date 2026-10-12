export function normalizeUsername(value: unknown) {
  return transliterateToLatin(String(value || '').trim())
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
}

export function normalizeLoginIdentifier(value: unknown) {
  const trimmed = String(value || '').trim()
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase()
  }

  return normalizeUsername(trimmed)
}

export function normalizeLoginIdentifierLegacy(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

const latinCharacterMap: Record<string, string> = {
  ß: 'ss',
  ẞ: 'SS',
  ı: 'i',
  İ: 'I',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ø: 'o',
  Ø: 'O',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  þ: 'th',
  Þ: 'TH',
  ð: 'd',
  Ð: 'D',
}

function transliterateToLatin(value: string) {
  return value
    .replace(/[ßẞıİłŁđĐøØæÆœŒþÞðÐ]/g, (character) => latinCharacterMap[character] || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
