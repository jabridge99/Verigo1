import { describe, it, expect, beforeEach } from 'vitest'
import { pricingEngine, computeExposure, DAILY_VOLUME_KG } from '../lib/pricingEngine'
import { overrideQueue } from '../lib/overrideQueue'

// ── computeExposure() ─────────────────────────────────────────────────────────

describe('computeExposure()', () => {
  it('returns zeroes for zero volume', () => {
    const result = computeExposure('aluminium', 2000, 0)
    expect(result.grossAud).toBe(0)
    expect(result.netAud).toBe(0)
    expect(result.marginAud).toBe(0)
    expect(result.marginPct).toBe(0)
    expect(result.consumerRate).toBe(0)
    expect(result.riskFlag).toBe(false)
  })

  it('returns zeroes for zero spot price', () => {
    const result = computeExposure('aluminium', 0, 1000)
    expect(result.grossAud).toBe(0)
    expect(result.netAud).toBe(0)
    expect(result.marginAud).toBe(0)
    expect(result.consumerRate).toBe(0)
    expect(result.riskFlag).toBe(false)
  })

  it('computes correctly for a normal aluminium case', () => {
    // aluminium: PLATFORM_MARGIN = 0.15, spot = 2000 AUD/t
    // spotPerKg = 2.0, consumerRate = 2.0 * (1 - 0.15) = 1.7
    // grossAud (revenue from scrap) = 2.0 * 1000 = 2000
    // netAud (cost paid to consumers) = 1.7 * 1000 = 1700
    // marginAud = 2000 - 1700 = 300, marginPct = 300/2000 * 100 = 15%
    const result = computeExposure('aluminium', 2000, 1000)
    expect(result.consumerRate).toBeCloseTo(1.7, 3)
    expect(result.grossAud).toBeCloseTo(2000, 1)
    expect(result.netAud).toBeCloseTo(1700, 1)
    expect(result.marginAud).toBeCloseTo(300, 1)
    expect(result.marginPct).toBeCloseTo(15, 0)
    // marginPct = 15 is NOT < 15, consumerRate 1.7 is NOT > spotPerKg 2.0 → no risk
    expect(result.riskFlag).toBe(false)
  })

  it('uses overrideRatePerKg when provided', () => {
    const overrideRate = 3.0
    const result = computeExposure('aluminium', 2000, 1000, overrideRate)
    expect(result.consumerRate).toBe(overrideRate)
    // grossAud is always revenue from scrap (spotPerKg × vol), not affected by override
    expect(result.grossAud).toBeCloseTo(2000, 1)
    // netAud is cost paid to consumers (overrideRate × vol)
    expect(result.netAud).toBeCloseTo(3000, 1)
  })

  it('sets riskFlag when override rate is above spot/kg (platform loses money)', () => {
    // spot = 1000 AUD/t → spotPerKg = 1.0
    // override rate = 1.5 > spotPerKg → consumer pays less than cost
    // Actually consumerRate > spotPerKg means consumer_rate > cost_per_kg
    // Wait: consumer pays consumerRate per kg, we buy at spotPerKg
    // If consumerRate > spotPerKg the consumer pays MORE than spot — that's not a risk in EcoBin context
    // Per code: riskFlag = marginPct < 15 || consumerRate > spotPerKg
    const result = computeExposure('aluminium', 1000, 500, 2.0) // overrideRate=2.0, spotPerKg=1.0 → riskFlag
    expect(result.riskFlag).toBe(true)
    expect(result.consumerRate).toBe(2.0)
  })

  it('has no riskFlag when margin is comfortably above 15% and rate is below spot', () => {
    // Glass has PLATFORM_MARGIN = 0.55 (55%): consumer gets 45% of spot
    // gross = spotPerKg × vol, net = 0.45 × spotPerKg × vol → marginPct ≈ 55%, well above 15%
    // consumerRate < spotPerKg → no override risk condition triggered
    const result = computeExposure('glass', 1000, 100)
    expect(result.riskFlag).toBe(false)
    expect(result.marginPct).toBeGreaterThan(15)
    expect(result.consumerRate).toBeLessThan(1.0) // spotPerKg = 1000/1000 = 1.0
  })
})

// ── pricingEngine.getExposureSummary() ───────────────────────────────────────

describe('pricingEngine.getExposureSummary()', () => {
  it('returns 7 rows (one per material)', () => {
    const summary = pricingEngine.getExposureSummary()
    expect(summary.rows).toHaveLength(7)
  })

  it('totalNotionalAud is a positive number', () => {
    const summary = pricingEngine.getExposureSummary()
    expect(summary.totalNotionalAud).toBeGreaterThan(0)
  })

  it('atRiskCount is a non-negative integer', () => {
    const summary = pricingEngine.getExposureSummary()
    expect(typeof summary.atRiskCount).toBe('number')
    expect(summary.atRiskCount).toBeGreaterThanOrEqual(0)
    expect(summary.atRiskCount).toBeLessThanOrEqual(7)
  })

  it('each row has required fields', () => {
    const { rows } = pricingEngine.getExposureSummary()
    for (const row of rows) {
      expect(row.material).toBeTruthy()
      expect(row.label).toBeTruthy()
      expect(typeof row.spot).toBe('number')
      expect(typeof row.consumerRate).toBe('number')
      expect(typeof row.marginPct).toBe('number')
      expect(typeof row.grossAud).toBe('number')
      expect(typeof row.marginAud).toBe('number')
      expect(typeof row.riskFlag).toBe('boolean')
      expect(typeof row.volumeKg).toBe('number')
    }
  })

  it('totalNotionalAud equals sum of row grossAud', () => {
    const summary = pricingEngine.getExposureSummary()
    const rowTotal = summary.rows.reduce((a, r) => a + r.grossAud, 0)
    expect(Math.abs(summary.totalNotionalAud - rowTotal)).toBeLessThan(1)
  })

  it('has updatedAt timestamp', () => {
    const summary = pricingEngine.getExposureSummary()
    expect(summary.updatedAt).toBeTruthy()
    expect(new Date(summary.updatedAt).getTime()).toBeGreaterThan(0)
  })
})

// ── pricingEngine.applyOverride() ────────────────────────────────────────────

describe('pricingEngine.applyOverride()', () => {
  beforeEach(() => {
    // Clear any overrides from previous tests
    for (const mat of Object.keys(pricingEngine.getOverrides())) {
      pricingEngine.clearOverride(mat)
    }
  })

  it('throws on unknown material', () => {
    expect(() => pricingEngine.applyOverride('unobtanium', 1.5)).toThrow('Unknown material: unobtanium')
  })

  it('throws on non-positive rate', () => {
    expect(() => pricingEngine.applyOverride('aluminium', 0)).toThrow()
    expect(() => pricingEngine.applyOverride('aluminium', -1)).toThrow()
  })

  it('sets override correctly and getOverrides() returns it', () => {
    pricingEngine.applyOverride('aluminium', 1.75, 'test-actor')
    const overrides = pricingEngine.getOverrides()
    expect(overrides.aluminium).toBeDefined()
    expect(overrides.aluminium.ratePerKg).toBe(1.75)
    expect(overrides.aluminium.actor).toBe('test-actor')
    expect(overrides.aluminium.appliedAt).toBeTruthy()
  })

  it('overrideCount increments when override is set', () => {
    const before = pricingEngine.overrideCount
    pricingEngine.applyOverride('glass', 0.04, 'test')
    expect(pricingEngine.overrideCount).toBe(before + 1)
  })

  it('reflected in getExposureSummary row', () => {
    pricingEngine.applyOverride('aluminium', 9.99, 'test')
    const summary = pricingEngine.getExposureSummary()
    const alRow = summary.rows.find(r => r.material === 'aluminium')
    expect(alRow.hasOverride).toBe(true)
    expect(alRow.consumerRate).toBe(9.99)
    expect(alRow.override).toBeDefined()
  })
})

// ── pricingEngine.clearOverride() ────────────────────────────────────────────

describe('pricingEngine.clearOverride()', () => {
  beforeEach(() => {
    for (const mat of Object.keys(pricingEngine.getOverrides())) {
      pricingEngine.clearOverride(mat)
    }
  })

  it('removes an existing override', () => {
    pricingEngine.applyOverride('aluminium', 2.0, 'test')
    expect(pricingEngine.getOverrides().aluminium).toBeDefined()
    pricingEngine.clearOverride('aluminium')
    expect(pricingEngine.getOverrides().aluminium).toBeUndefined()
  })

  it('is a no-op if override not set (does not throw)', () => {
    expect(() => pricingEngine.clearOverride('steel')).not.toThrow()
  })

  it('decrements overrideCount', () => {
    pricingEngine.applyOverride('steel', 0.2)
    const before = pricingEngine.overrideCount
    pricingEngine.clearOverride('steel')
    expect(pricingEngine.overrideCount).toBe(before - 1)
  })
})

// ── overrideQueue.submit() ────────────────────────────────────────────────────

describe('overrideQueue.submit()', () => {
  it('returns an ID in OVR-XXXXX format', () => {
    const id = overrideQueue.submit('aluminium', 1.5, 'test rationale', 'trader1')
    expect(id).toMatch(/^OVR-\d{5}$/)
  })

  it('request appears in getQueue("pending")', () => {
    const id = overrideQueue.submit('glass', 0.03, 'low price signal', 'trader2')
    const pending = overrideQueue.getQueue('pending')
    const req = pending.find(r => r.id === id)
    expect(req).toBeDefined()
    expect(req.status).toBe('pending')
    expect(req.material).toBe('glass')
    expect(req.proposedRate).toBe(0.03)
    expect(req.rationale).toBe('low price signal')
    expect(req.trader).toBe('trader2')
  })

  it('increments pendingCount', () => {
    const before = overrideQueue.pendingCount
    overrideQueue.submit('steel', 0.15, 'market move')
    expect(overrideQueue.pendingCount).toBe(before + 1)
  })

  it('request has required fields', () => {
    const id = overrideQueue.submit('hdpe', 0.25, 'test')
    const req = overrideQueue.getQueue().find(r => r.id === id)
    expect(req.id).toBe(id)
    expect(req.material).toBe('hdpe')
    expect(req.status).toBe('pending')
    expect(req.createdAt).toBeTruthy()
    expect(req.resolvedAt).toBeNull()
    expect(req.approver).toBeNull()
  })
})

// ── overrideQueue.approve() ───────────────────────────────────────────────────

describe('overrideQueue.approve()', () => {
  it('changes status to approved', () => {
    const id = overrideQueue.submit('aluminium', 1.8, 'approve test')
    const req = overrideQueue.approve(id, 'admin')
    expect(req.status).toBe('approved')
    expect(req.approver).toBe('admin')
    expect(req.resolvedAt).toBeTruthy()
  })

  it('approved request no longer in pending queue', () => {
    const id = overrideQueue.submit('glass', 0.035, 'approve test 2')
    overrideQueue.approve(id, 'admin')
    const pending = overrideQueue.getQueue('pending')
    expect(pending.find(r => r.id === id)).toBeUndefined()
  })

  it('throws if request ID does not exist', () => {
    expect(() => overrideQueue.approve('OVR-99999', 'admin')).toThrow()
  })

  it('throws if already approved (not pending)', () => {
    const id = overrideQueue.submit('steel', 0.18, 'double approve test')
    overrideQueue.approve(id, 'admin')
    expect(() => overrideQueue.approve(id, 'admin')).toThrow()
  })

  it('approved request is retrievable from full queue', () => {
    const id = overrideQueue.submit('paperboard', 0.07, 'approve full queue test')
    overrideQueue.approve(id, 'admin')
    const all = overrideQueue.getQueue()
    const req = all.find(r => r.id === id)
    expect(req).toBeDefined()
    expect(req.status).toBe('approved')
  })
})

// ── overrideQueue.reject() ────────────────────────────────────────────────────

describe('overrideQueue.reject()', () => {
  it('changes status to rejected', () => {
    const id = overrideQueue.submit('aluminium', 0.5, 'reject test')
    const req = overrideQueue.reject(id, 'admin', 'price too aggressive')
    expect(req.status).toBe('rejected')
    expect(req.approver).toBe('admin')
    expect(req.rejectReason).toBe('price too aggressive')
    expect(req.resolvedAt).toBeTruthy()
  })

  it('stores reason in rejectReason field', () => {
    const id = overrideQueue.submit('glass', 0.01, 'too low test')
    overrideQueue.reject(id, 'admin', 'outside approved range')
    const req = overrideQueue.getQueue().find(r => r.id === id)
    expect(req.rejectReason).toBe('outside approved range')
  })

  it('throws if request ID does not exist', () => {
    expect(() => overrideQueue.reject('OVR-99998', 'admin', 'not found')).toThrow()
  })

  it('throws if already rejected (not pending)', () => {
    const id = overrideQueue.submit('steel', 0.1, 'double reject test')
    overrideQueue.reject(id, 'admin', 'first rejection')
    expect(() => overrideQueue.reject(id, 'admin', 'second rejection')).toThrow()
  })

  it('rejected request no longer in pending queue', () => {
    const id = overrideQueue.submit('mixed_plastic', 0.04, 'reject pending test')
    overrideQueue.reject(id, 'admin', 'reason')
    const pending = overrideQueue.getQueue('pending')
    expect(pending.find(r => r.id === id)).toBeUndefined()
  })
})

// ── DAILY_VOLUME_KG ───────────────────────────────────────────────────────────

describe('DAILY_VOLUME_KG', () => {
  it('has 7 entries', () => {
    expect(Object.keys(DAILY_VOLUME_KG)).toHaveLength(7)
  })

  it('all volumes are positive numbers', () => {
    for (const [mat, vol] of Object.entries(DAILY_VOLUME_KG)) {
      expect(typeof vol).toBe('number')
      expect(vol).toBeGreaterThan(0)
    }
  })
})
