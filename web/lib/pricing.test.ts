import { describe, expect, it } from 'vitest'
import { annualSavingsPct, formatAud } from './pricing'

describe('formatAud', () => {
  it('formats a whole-dollar amount with no decimals', () => {
    expect(formatAud(59)).toBe('$59')
  })

  it('formats a fractional amount to 2 decimal places', () => {
    expect(formatAud(59.5)).toBe('$59.50')
  })

  it('renders "Custom" for a null price (enterprise/contact-us tiers)', () => {
    expect(formatAud(null)).toBe('Custom')
  })

  it('formats zero as a real price, not as "Custom"', () => {
    expect(formatAud(0)).toBe('$0')
  })
})

describe('annualSavingsPct', () => {
  it('computes the real discount percentage shown to customers', () => {
    // $59/mo -> $708/yr full price; $599/yr actual -> ~15.4% saved
    expect(annualSavingsPct(59, 599)).toBe(15)
  })

  it('returns null when monthly is null (nothing to compare against)', () => {
    expect(annualSavingsPct(null, 599)).toBeNull()
  })

  it('returns null when annual is null', () => {
    expect(annualSavingsPct(59, null)).toBeNull()
  })

  it('returns 0 for identical monthly-equivalent pricing, not a false discount', () => {
    expect(annualSavingsPct(50, 600)).toBe(0)
  })
})
