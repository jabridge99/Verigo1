// SLA tier engine — tracks operator performance tiers and earnings multipliers

import { bus } from './eventBus'

export const SLA_TIERS = [
  { tier: 'bronze',   label: 'Bronze',   min: 0,   max: 49,       multiplier: 1.00, color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { tier: 'silver',   label: 'Silver',   min: 50,  max: 149,      multiplier: 1.05, color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { tier: 'gold',     label: 'Gold',     min: 150, max: 299,      multiplier: 1.12, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { tier: 'platinum', label: 'Platinum', min: 300, max: Infinity, multiplier: 1.20, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
]

// Base rate per kg collected (AUD) before tier multiplier
export const BASE_RATE_PER_KG = 0.18

class SLAEngine {
  #currentTier = null

  /**
   * Return tier info for a given monthly collection count.
   * @param {number} collectionsThisMonth
   * @returns {{ tier, label, multiplier, nextTier, collectionsToNext, color, bg, border }}
   */
  getTier(collectionsThisMonth) {
    const current = SLA_TIERS.findLast(t => collectionsThisMonth >= t.min) ?? SLA_TIERS[0]
    const nextIdx = SLA_TIERS.indexOf(current) + 1
    const next    = SLA_TIERS[nextIdx] ?? null

    return {
      ...current,
      nextTier:          next ?? null,
      collectionsToNext: next ? Math.max(0, next.min - collectionsThisMonth) : 0,
      progressPct:       next
        ? Math.round(((collectionsThisMonth - current.min) / (next.min - current.min)) * 100)
        : 100,
    }
  }

  /**
   * Compute earnings for a set of collections.
   * @param {{ collectionsCount, totalKg, baseRatePerKg? }} params
   * @returns {{ baseAud, multiplier, totalAud, tier, label }}
   */
  computeEarnings({ collectionsCount, totalKg, baseRatePerKg = BASE_RATE_PER_KG }) {
    const tierInfo  = this.getTier(collectionsCount)
    const baseAud   = Math.round(totalKg * baseRatePerKg * 100) / 100
    const totalAud  = Math.round(baseAud * tierInfo.multiplier * 100) / 100
    return {
      baseAud,
      multiplier: tierInfo.multiplier,
      totalAud,
      tier:  tierInfo.tier,
      label: tierInfo.label,
    }
  }

  /**
   * Notify a tier upgrade. Call when an operator's monthly count crosses a threshold.
   */
  notifyUpgrade(operatorId, fromTier, toTier) {
    bus.publish('sla.tier.upgraded', { operatorId, fromTier, toTier })
  }

  /**
   * Synthetic leaderboard of mock operators sorted by monthly collections.
   */
  getLeaderboard() {
    const operators = [
      { id: 'OP-001', name: 'GreenLoop Sydney',     collections: 342, kg: 18400 },
      { id: 'OP-002', name: 'EcoHaul Inner West',   collections: 278, kg: 15600 },
      { id: 'OP-003', name: 'CircularCity Eastern', collections: 201, kg: 11200 },
      { id: 'OP-004', name: 'RecyclePro Southern',  collections: 183, kg: 10100 },
      { id: 'OP-005', name: 'BinRunner Northern',   collections: 148, kg: 8300 },
      { id: 'OP-006', name: 'EcoPickup Western',    collections: 112, kg: 6100 },
      { id: 'OP-007', name: 'GreenRun Parramatta',  collections: 67,  kg: 3800 },
      { id: 'OP-008', name: 'ClearBin Penrith',     collections: 34,  kg: 1900 },
    ]
    return operators
      .map(op => {
        const tierInfo = this.getTier(op.collections)
        const earnings = this.computeEarnings({ collectionsCount: op.collections, totalKg: op.kg })
        return { ...op, ...tierInfo, earnings }
      })
      .sort((a, b) => b.collections - a.collections)
  }
}

export const slaEngine = new SLAEngine()
