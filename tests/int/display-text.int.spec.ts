import { describe, expect, it } from 'vitest'
import { normalizeDisplayText, normalizeDisplayTextInput } from '@/lib/display-text'

describe('display text normalization', () => {
  it('title-cases Turkish names with Turkish casing rules', () => {
    expect(normalizeDisplayText('GÖRKEM')).toBe('Görkem')
    expect(normalizeDisplayText('İLHAN')).toBe('İlhan')
    expect(normalizeDisplayText('BETÜL')).toBe('Betül')
    expect(normalizeDisplayText('BİROL')).toBe('Birol')
    expect(normalizeDisplayText('ışık')).toBe('Işık')
  })

  it('preserves non-Turkish accented letters', () => {
    expect(normalizeDisplayText('MÜLLER')).toBe('Müller')
    expect(normalizeDisplayText('ŁUKASZ')).toBe('Łukasz')
  })

  it('normalizes whitespace and title-cases multi-word titles', () => {
    expect(normalizeDisplayText('  AYŞE   BETÜL  ')).toBe('Ayşe Betül')
    expect(normalizeDisplayText('SENIOR SOFTWARE ENGINEER')).toBe('Senior Software Engineer')
    expect(normalizeDisplayText('satış müdürü')).toBe('Satış Müdürü')
  })

  it('title-cases separated words while preserving separators', () => {
    expect(normalizeDisplayText('MARIE-CURIE')).toBe('Marie-Curie')
    expect(normalizeDisplayText("O'CONNOR")).toBe("O'Connor")
    expect(normalizeDisplayText('FINANCE/OPERATIONS.LEAD')).toBe('Finance/Operations.Lead')
  })

  it('keeps one trailing space for live input normalization', () => {
    expect(normalizeDisplayTextInput('john ')).toBe('John ')
    expect(normalizeDisplayTextInput('john  doe')).toBe('John Doe')
  })
})
