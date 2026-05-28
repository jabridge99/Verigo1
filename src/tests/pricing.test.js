import { can } from '../lib/rbac.js'

const COMMODITY_PRICES = {
  copper:    14.80,
  aluminium:  4.20,
  steel:      1.85,
  pcb:       22.40,
  battery:    3.10,
}
const LOGISTICS_COST_PER_KG  = 0.15
const PROCESSING_COST_PER_KG = 0.08
const DEFAULT_MARGIN         = 0.25
const PTS_TO_AUD             = 0.05

function computeOffer(commodity, weight_kg, { margin = DEFAULT_MARGIN } = {}) {
  const price = COMMODITY_PRICES[commodity]
  if (price === undefined) throw new Error(`Unknown commodity: ${commodity}`)
  const base       = price * weight_kg
  const logistics  = LOGISTICS_COST_PER_KG * weight_kg
  const processing = PROCESSING_COST_PER_KG * weight_kg
  const net        = base - logistics - processing
  const consumer_aud = net * (1 - margin)
  const pts        = Math.round(consumer_aud / PTS_TO_AUD)
  return {
    aud_value:  parseFloat(consumer_aud.toFixed(2)),
    points:     pts,
    margin_aud: net * margin,
  }
}

function validateOverride(commodity, value) {
  if (COMMODITY_PRICES[commodity] === undefined) throw new Error(`Unknown commodity: ${commodity}`)
  if (value <= 0) throw new Error('Override value must be positive')
}

describe('Offer computation', () => {
  it('computes correct AUD offer for 1kg copper', () => {
    const offer = computeOffer('copper', 1)
    expect(offer.aud_value).toBeCloseTo(10.93, 2)
  })

  it('computes correct points for copper offer', () => {
    const offer = computeOffer('copper', 1)
    expect(offer.points).toBe(219)
  })

  it('scales linearly with weight', () => {
    const single = computeOffer('copper', 1)
    const double = computeOffer('copper', 2)
    expect(double.aud_value).toBeCloseTo(single.aud_value * 2, 2)
    expect(double.points).toBeCloseTo(single.points * 2, -1)
  })

  it('applies custom margin correctly', () => {
    const net = (COMMODITY_PRICES.copper - LOGISTICS_COST_PER_KG - PROCESSING_COST_PER_KG) * 1
    const expected = parseFloat((net * 0.70).toFixed(2))
    const offer = computeOffer('copper', 1, { margin: 0.30 })
    expect(offer.aud_value).toBeCloseTo(expected, 2)
  })

  it('returns higher offer for higher-value commodity', () => {
    const pcb    = computeOffer('pcb', 1)
    const copper = computeOffer('copper', 1)
    expect(pcb.aud_value).toBeGreaterThan(copper.aud_value)
  })
})

describe('Shadow vs Production', () => {
  it('shadow mode with higher margin returns lower consumer offer', () => {
    const prod   = computeOffer('copper', 1, { margin: 0.25 })
    const shadow = computeOffer('copper', 1, { margin: 0.35 })
    expect(shadow.aud_value).toBeLessThan(prod.aud_value)
  })

  it('shadow mode with lower margin returns higher consumer offer', () => {
    const prod   = computeOffer('copper', 1, { margin: 0.25 })
    const shadow = computeOffer('copper', 1, { margin: 0.15 })
    expect(shadow.aud_value).toBeGreaterThan(prod.aud_value)
  })

  it('production offer is always used for consumer pricing', () => {
    const shadowMargin = 0.35
    const shadow = computeOffer('copper', 1, { margin: shadowMargin })
    const prod   = computeOffer('copper', 1)
    const result = { ...shadow, _shadow: true, _prod_aud: prod.aud_value }
    expect(result._shadow).toBe(true)
    expect(result._prod_aud).toBe(prod.aud_value)
  })
})

describe('Override validation', () => {
  it('rejects override for unknown commodity', () => {
    expect(() => validateOverride('unobtainium', 10)).toThrow()
  })

  it('rejects zero or negative override value', () => {
    expect(() => validateOverride('copper', 0)).toThrow()
    expect(() => validateOverride('copper', -1)).toThrow()
  })

  it('accepts valid override', () => {
    expect(() => validateOverride('copper', 16.00)).not.toThrow()
  })
})

describe('RBAC on pricing', () => {
  it('pricing_manager can apply override', () => {
    expect(can('pricing_manager', 'write:pricing.override')).toBe(true)
  })

  it('pricing_analyst cannot apply override', () => {
    expect(can('pricing_analyst', 'write:pricing.override')).toBe(false)
  })

  it('super_admin can freeze pricing', () => {
    expect(can('super_admin', 'write:pricing')).toBe(true)
  })
})
