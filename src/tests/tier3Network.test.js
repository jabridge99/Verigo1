import { describe, it, expect } from 'vitest'
import { slaEngine, SLA_TIERS, BASE_RATE_PER_KG } from '../lib/slaEngine'
import { carbonEngine, CO2_FACTORS } from '../lib/carbonEngine'

// ── slaEngine.getTier() ───────────────────────────────────────────────────────

describe('slaEngine.getTier()', () => {
  it('returns Bronze for 0 collections', () => {
    const t = slaEngine.getTier(0)
    expect(t.tier).toBe('bronze')
    expect(t.label).toBe('Bronze')
    expect(t.multiplier).toBe(1.00)
  })

  it('returns Bronze at boundary max (49)', () => {
    const t = slaEngine.getTier(49)
    expect(t.tier).toBe('bronze')
  })

  it('returns Silver at lower boundary (50)', () => {
    const t = slaEngine.getTier(50)
    expect(t.tier).toBe('silver')
    expect(t.multiplier).toBe(1.05)
  })

  it('returns Silver at upper boundary (149)', () => {
    const t = slaEngine.getTier(149)
    expect(t.tier).toBe('silver')
  })

  it('returns Gold at lower boundary (150)', () => {
    const t = slaEngine.getTier(150)
    expect(t.tier).toBe('gold')
    expect(t.multiplier).toBe(1.12)
  })

  it('returns Gold at upper boundary (299)', () => {
    const t = slaEngine.getTier(299)
    expect(t.tier).toBe('gold')
  })

  it('returns Platinum at boundary (300)', () => {
    const t = slaEngine.getTier(300)
    expect(t.tier).toBe('platinum')
    expect(t.multiplier).toBe(1.20)
  })

  it('returns Platinum for large values', () => {
    const t = slaEngine.getTier(9999)
    expect(t.tier).toBe('platinum')
  })

  it('Platinum has no nextTier', () => {
    const t = slaEngine.getTier(400)
    expect(t.nextTier).toBeNull()
    expect(t.collectionsToNext).toBe(0)
  })

  it('Silver reports correct collectionsToNext', () => {
    const t = slaEngine.getTier(100)
    expect(t.collectionsToNext).toBe(50)  // needs 150 for Gold
  })

  it('progressPct is 100 for Platinum', () => {
    const t = slaEngine.getTier(500)
    expect(t.progressPct).toBe(100)
  })
})

// ── slaEngine.computeEarnings() ───────────────────────────────────────────────

describe('slaEngine.computeEarnings()', () => {
  it('Bronze applies 1.00× multiplier', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 25, totalKg: 1000 })
    expect(e.multiplier).toBe(1.00)
    expect(e.totalAud).toBeCloseTo(1000 * BASE_RATE_PER_KG * 1.00, 2)
  })

  it('Silver applies 1.05× multiplier', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 80, totalKg: 1000 })
    expect(e.multiplier).toBe(1.05)
    expect(e.totalAud).toBeCloseTo(1000 * BASE_RATE_PER_KG * 1.05, 2)
  })

  it('Gold applies 1.12× multiplier', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 200, totalKg: 1000 })
    expect(e.multiplier).toBe(1.12)
    expect(e.totalAud).toBeCloseTo(1000 * BASE_RATE_PER_KG * 1.12, 2)
  })

  it('Platinum applies 1.20× multiplier', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 350, totalKg: 1000 })
    expect(e.multiplier).toBe(1.20)
    expect(e.totalAud).toBeCloseTo(1000 * BASE_RATE_PER_KG * 1.20, 2)
  })

  it('totalAud > baseAud for Silver and above', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 100, totalKg: 500 })
    expect(e.totalAud).toBeGreaterThan(e.baseAud)
  })

  it('totalAud === baseAud for Bronze', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 10, totalKg: 500 })
    expect(e.totalAud).toBeCloseTo(e.baseAud, 2)
  })

  it('respects custom baseRatePerKg', () => {
    const e = slaEngine.computeEarnings({ collectionsCount: 10, totalKg: 100, baseRatePerKg: 0.50 })
    expect(e.baseAud).toBeCloseTo(50, 2)
  })
})

// ── carbonEngine.computeCO2Saved() ───────────────────────────────────────────

describe('carbonEngine.computeCO2Saved()', () => {
  const cases = Object.entries(CO2_FACTORS)

  it.each(cases)('computes CO₂ for %s', (material, factor) => {
    const result = carbonEngine.computeCO2Saved(material, 100)
    expect(result).toBeCloseTo(factor * 100, 2)
  })

  it('returns 0 for zero weight', () => {
    expect(carbonEngine.computeCO2Saved('aluminium', 0)).toBe(0)
  })

  it('returns 0 for unknown material', () => {
    expect(carbonEngine.computeCO2Saved('unobtanium', 100)).toBe(0)
  })

  it('aluminium: 1 kg = 9.5 kg CO₂', () => {
    expect(carbonEngine.computeCO2Saved('aluminium', 1)).toBeCloseTo(9.5, 3)
  })

  it('glass: 1000 kg = 300 kg CO₂', () => {
    expect(carbonEngine.computeCO2Saved('glass', 1000)).toBeCloseTo(300, 2)
  })

  it('steel: 500 kg = 1150 kg CO₂', () => {
    expect(carbonEngine.computeCO2Saved('steel', 500)).toBeCloseTo(1150, 2)
  })
})

// ── carbonEngine.getTotalCO2Saved() ──────────────────────────────────────────

describe('carbonEngine.getTotalCO2Saved()', () => {
  it('sums correctly across all 7 materials', () => {
    const breakdown = {
      aluminium: 100, pet_plastic: 100, hdpe: 100,
      glass: 100, steel: 100, paperboard: 100, mixed_plastic: 100,
    }
    const expected = (9.5 + 2.5 + 1.8 + 0.3 + 2.3 + 1.1 + 1.5) * 100
    expect(carbonEngine.getTotalCO2Saved(breakdown)).toBeCloseTo(expected, 2)
  })

  it('returns 0 for empty breakdown', () => {
    expect(carbonEngine.getTotalCO2Saved({})).toBe(0)
  })

  it('handles partial breakdown (subset of materials)', () => {
    const result = carbonEngine.getTotalCO2Saved({ aluminium: 1000 })
    expect(result).toBeCloseTo(9500, 2)
  })

  it('ignores unknown materials', () => {
    const result = carbonEngine.getTotalCO2Saved({ aluminium: 1, unknown_mat: 999 })
    expect(result).toBeCloseTo(9.5, 2)
  })
})

// ── carbonEngine.getEquivalents() ────────────────────────────────────────────

describe('carbonEngine.getEquivalents()', () => {
  it('returns zero equivalents for 0 kg CO₂', () => {
    const eq = carbonEngine.getEquivalents(0)
    expect(eq.trees).toBe(0)
    expect(eq.kmNotDriven).toBe(0)
    expect(eq.flightsAvoided).toBe(0)
  })

  it('22 kg CO₂ = 1 tree', () => {
    const eq = carbonEngine.getEquivalents(22)
    expect(eq.trees).toBeCloseTo(1.0, 1)
  })

  it('0.21 kg CO₂ ≈ 1 km not driven', () => {
    const eq = carbonEngine.getEquivalents(0.21)
    expect(eq.kmNotDriven).toBeCloseTo(1.0, 1)
  })

  it('255 kg CO₂ = 1 flight Syd↔Mel', () => {
    const eq = carbonEngine.getEquivalents(255)
    expect(eq.flightsAvoided).toBeCloseTo(1.0, 2)
  })

  it('1000 kg CO₂ → correct tree count', () => {
    const eq = carbonEngine.getEquivalents(1000)
    expect(eq.trees).toBeCloseTo(1000 / 22, 1)
  })
})

// ── SLA_TIERS constant ────────────────────────────────────────────────────────

describe('SLA_TIERS', () => {
  it('has 4 tiers', () => {
    expect(SLA_TIERS).toHaveLength(4)
  })

  it('tiers are in ascending order of min collections', () => {
    for (let i = 1; i < SLA_TIERS.length; i++) {
      expect(SLA_TIERS[i].min).toBeGreaterThan(SLA_TIERS[i - 1].min)
    }
  })

  it('multipliers are in ascending order', () => {
    for (let i = 1; i < SLA_TIERS.length; i++) {
      expect(SLA_TIERS[i].multiplier).toBeGreaterThan(SLA_TIERS[i - 1].multiplier)
    }
  })

  it('Platinum tier has Infinity max', () => {
    const platinum = SLA_TIERS.find(t => t.tier === 'platinum')
    expect(platinum.max).toBe(Infinity)
  })
})

// ── CO2_FACTORS constant ──────────────────────────────────────────────────────

describe('CO2_FACTORS', () => {
  it('has 7 materials', () => {
    expect(Object.keys(CO2_FACTORS)).toHaveLength(7)
  })

  it('all factors are positive numbers', () => {
    for (const [mat, factor] of Object.entries(CO2_FACTORS)) {
      expect(typeof factor).toBe('number')
      expect(factor).toBeGreaterThan(0)
    }
  })

  it('aluminium has highest factor (9.5)', () => {
    const max = Math.max(...Object.values(CO2_FACTORS))
    expect(CO2_FACTORS.aluminium).toBe(max)
    expect(max).toBe(9.5)
  })
})
