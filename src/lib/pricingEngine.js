// Dynamic pricing engine
// Sits on top of marketFeed: tracks live spot prices, manages per-material rate overrides,
// computes platform exposure, and fires subscriber callbacks on every market tick.

import { marketFeed, COMMODITIES, PLATFORM_MARGIN, spotToConsumerRate } from './marketFeed'
import { bus } from './eventBus'
import { audit, AUDIT_ACTIONS } from './audit'

// ── Daily volume estimates (kg) per material — used for notional exposure ────
export const DAILY_VOLUME_KG = {
  aluminium:     4200,
  pet_plastic:   3100,
  hdpe:          2400,
  glass:         5800,
  steel:         3600,
  paperboard:    6200,
  mixed_plastic: 2800,
}

// ── Pure exposure calculation ─────────────────────────────────────────────────
/**
 * Compute exposure for one material at a given spot price.
 * @param {string} material
 * @param {number} spotAudPerTonne
 * @param {number} volumeKg
 * @param {number|null} overrideRatePerKg  — null = use derived consumer rate
 * @returns {{ grossAud, netAud, marginAud, marginPct, consumerRate, riskFlag }}
 */
export function computeExposure(material, spotAudPerTonne, volumeKg, overrideRatePerKg = null) {
  if (spotAudPerTonne <= 0 || volumeKg <= 0) {
    return { grossAud: 0, netAud: 0, marginAud: 0, marginPct: 0, consumerRate: 0, riskFlag: false }
  }
  const margin      = PLATFORM_MARGIN[material] ?? 0.25
  const spotPerKg   = spotAudPerTonne / 1000
  const consumerRate = overrideRatePerKg != null ? overrideRatePerKg : spotToConsumerRate(spotAudPerTonne, margin)
  // Platform sells recyclables to scrap dealers at spot; pays consumers at consumerRate
  const grossAud    = Math.round(spotPerKg    * volumeKg * 100) / 100  // revenue from scrap dealers
  const costAud     = Math.round(consumerRate * volumeKg * 100) / 100  // paid to consumers
  const marginAud   = Math.round((grossAud - costAud) * 100) / 100
  const marginPct   = grossAud > 0 ? Math.round((marginAud / grossAud) * 10000) / 100 : 0
  // Risk: margin below 15% OR consumer override rate exceeds spot (platform at a loss)
  const riskFlag    = marginPct < 15 || consumerRate > spotPerKg
  return { grossAud, netAud: costAud, marginAud, marginPct, consumerRate, riskFlag }
}

// ── Engine ────────────────────────────────────────────────────────────────────

class PricingEngine {
  #overrides  = new Map()   // material → { ratePerKg, actor, appliedAt }
  #subs       = new Set()
  #unsub      = null        // unsubscribe from marketFeed

  start() {
    if (this.#unsub) return this
    this.#unsub = marketFeed.subscribe(null, () => {
      const summary = this.getExposureSummary()
      for (const h of this.#subs) try { h(summary) } catch {}
      bus.publish('pricing.exposure.updated', { summary })
    })
    return this
  }

  stop() {
    if (this.#unsub) { this.#unsub(); this.#unsub = null }
  }

  applyOverride(material, newRatePerKg, actor = 'system') {
    if (!COMMODITIES[material]) throw new Error(`Unknown material: ${material}`)
    if (newRatePerKg <= 0)      throw new Error(`Rate must be positive: ${newRatePerKg}`)
    const prev = this.#overrides.get(material) ?? null
    this.#overrides.set(material, { ratePerKg: newRatePerKg, actor, appliedAt: new Date().toISOString() })
    void audit(AUDIT_ACTIONS.PRICE_OVERRIDE_APPLIED, {
      actor, entityId: material,
      before: prev ? { ratePerKg: prev.ratePerKg } : null,
      after:  { ratePerKg: newRatePerKg },
    })
    bus.publish('pricing.override.applied', { material, newRatePerKg, actor })
  }

  clearOverride(material, actor = 'system') {
    if (!this.#overrides.has(material)) return
    const prev = this.#overrides.get(material)
    this.#overrides.delete(material)
    void audit(AUDIT_ACTIONS.PRICE_OVERRIDE_CLEARED, {
      actor, entityId: material,
      before: { ratePerKg: prev.ratePerKg }, after: null,
    })
    bus.publish('pricing.override.cleared', { material, actor })
  }

  getOverrides() {
    return Object.fromEntries(this.#overrides.entries())
  }

  getExposureSummary() {
    const prices = marketFeed.getAllPrices()
    const rows   = []
    let totalNotional = 0
    let totalMargin   = 0
    let atRisk        = 0

    for (const material of Object.keys(COMMODITIES)) {
      const price    = prices[material]
      if (!price) continue
      const volKg    = DAILY_VOLUME_KG[material] ?? 1000
      const override = this.#overrides.get(material) ?? null
      const exp      = computeExposure(material, price.spot, volKg, override?.ratePerKg ?? null)
      totalNotional += exp.grossAud
      totalMargin   += exp.marginAud
      if (exp.riskFlag) atRisk++
      rows.push({
        material,
        label:         price.label,
        spot:          price.spot,
        consumerRate:  exp.consumerRate,
        marginPct:     exp.marginPct,
        grossAud:      exp.grossAud,
        marginAud:     exp.marginAud,
        riskFlag:      exp.riskFlag,
        volumeKg:      volKg,
        hasOverride:   !!override,
        override:      override,
      })
    }

    const weightedMarginPct = totalNotional > 0 ? Math.round((totalMargin / totalNotional) * 10000) / 100 : 0

    return {
      totalNotionalAud:  Math.round(totalNotional * 100) / 100,
      totalMarginAud:    Math.round(totalMargin   * 100) / 100,
      weightedMarginPct,
      atRiskCount:       atRisk,
      rows,
      updatedAt:         new Date().toISOString(),
    }
  }

  subscribe(handler) {
    this.#subs.add(handler)
    handler(this.getExposureSummary())
    return () => this.#subs.delete(handler)
  }

  get overrideCount() { return this.#overrides.size }
}

export const pricingEngine = new PricingEngine()
