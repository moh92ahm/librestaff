import { describe, expect, it } from 'vitest'
import { normalizePhoneNumber } from '@/lib/phone-numbers'

describe('phone number normalization', () => {
  it('removes whitespace and adds a leading plus', () => {
    expect(normalizePhoneNumber('90 555 111 22 33')).toBe('+905551112233')
  })

  it('keeps exactly one leading plus', () => {
    expect(normalizePhoneNumber('+90 555 111 22 33')).toBe('+905551112233')
    expect(normalizePhoneNumber('++90 555')).toBe('+90555')
  })

  it('preserves non-space punctuation other than plus signs', () => {
    expect(normalizePhoneNumber('(90) 555-111')).toBe('+(90)555-111')
  })

  it('returns an empty string for empty values', () => {
    expect(normalizePhoneNumber('   ')).toBe('')
    expect(normalizePhoneNumber(null)).toBe('')
  })
})
