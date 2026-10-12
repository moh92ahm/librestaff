import { describe, expect, it } from 'vitest'
import {
  normalizeLoginIdentifier,
  normalizeLoginIdentifierLegacy,
  normalizeUsername,
} from '@/lib/usernames'

describe('username normalization', () => {
  it('transliterates Turkish characters and lowercases usernames', () => {
    expect(normalizeUsername('  ÇağrıKAYA  ')).toBe('cagrikaya')
    expect(normalizeUsername('İlker IŞIK')).toBe('ilkerisik')
  })

  it('transliterates German and Polish characters', () => {
    expect(normalizeUsername('Müller')).toBe('muller')
    expect(normalizeUsername('straße')).toBe('strasse')
    expect(normalizeUsername('Łukasz Żółć')).toBe('lukaszzolc')
  })

  it('keeps only username-safe ASCII characters', () => {
    expect(normalizeUsername(' John.Doe_42-test! ')).toBe('john.doe_42-test')
  })

  it('normalizes login emails without transliterating them as usernames', () => {
    expect(normalizeLoginIdentifier('  USER+TEST@EXAMPLE.COM  ')).toBe('user+test@example.com')
  })

  it('normalizes non-email login identifiers as usernames', () => {
    expect(normalizeLoginIdentifier(' Çağrı.KAYA! ')).toBe('cagri.kaya')
  })

  it('keeps a legacy lowercase form for existing stored username lookup', () => {
    expect(normalizeLoginIdentifierLegacy(' ÇağrıKAYA ')).toBe('çağrıkaya')
  })
})
