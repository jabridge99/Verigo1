// Commodity market price feed
// Simulates a real-time price stream using an Ornstein-Uhlenbeck mean-reverting
// random walk — the same model used in commodity quant desks for demo/test environments.
// Base prices sourced from LME / Australian scrap market Q1 2025 actuals.

import { bus } from './eventBus'

// ── Market definitions ────────────────────────────────────────────────────────

export const COMMODITIES = {
  aluminium:     { label: 'Aluminium',     unit: 'AUD/t',  base: 2180, vol: 0.008, mr: 0.05, exchange: 'LME',    grade: 'UBC Scrap'      },
  pet_plastic:   { label: 'PET Plastic',   unit: 'AUD/t',  base: 320,  vol: 0.012, mr: 0.04, exchange: 'ASTMA',  grade: 'Clear Baled'    },
  hdpe:          { label: 'HDPE',          unit: 'AUD/t',  base: 280,  vol: 0.011, mr: 0.04, exchange: 'ASTMA',  grade: 'Natural Baled'  },
  glass:         { label: 'Clear Glass',   unit: 'AUD/t',  base: 45,   vol: 0.005, mr: 0.08, exchange: 'Local',  grade: 'Cullet'         },
  steel:         { label: 'Steel Cans',    unit: 'AUD/t',  base: 195,  vol: 0.009, mr: 0.06, exchange: 'LME',    grade: 'No.1 Shredded'  },
  paperboard:    { label: 'Paperboard',    unit: 'AUD/t',  base: 85,   vol: 0.015, mr: 0.07, exchange: 'RISI',   grade: 'OCC Grade'      },
  mixed_plastic: { label: 'Mixed Plastic', unit: 'AUD/t',  base: 55,   vol: 0.020, mr: 0.05, exchange: 'ASTMA',  grade: 'Commingled'     },
}

export const PLATFORM_MARGIN = {
  aluminium:     0.15,
  pet_plastic:   0.25,
  hdpe:          0.25,
  glass:         0.55,
  steel:         0.28,
  paperboard:    0.30,
  mixed_plastic: 0.25,
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Convert AUD/tonne spot to AUD/kg consumer rate after platform margin */
export function spotToConsumerRate(spotAudPerTonne, marginFraction) {
  return Math.round((spotAudPerTonne / 1000) * (1 - marginFraction) * 10000) / 10000
}

export function formatPrice(value, unit) {
  if (unit === 'AUD/t')  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/t`
  if (unit === 'AUD/kg') return `$${value.toFixed(4)}/kg`
  return `$${value}`
}

// ── Feed class ────────────────────────────────────────────────────────────────

class MarketFeed {
  #prices    = {}          // material → PriceRecord
  #history   = {}          // material → Array<{ price, timestamp }>
  #subs      = new Map()   // material → Set<fn>
  #globalSubs = new Set()
  #timer     = null
  #running   = false
  #tickCount = 0

  constructor() {
    const now = new Date().toISOString()
    for (const [material, cfg] of Object.entries(COMMODITIES)) {
      this.#prices[material] = this.#makeRecord(material, cfg.base, cfg.base, now)
      this.#history[material] = this.#buildInitialHistory(material, cfg)
    }
  }

  #makeRecord(material, spot, open, timestamp) {
    const cfg    = COMMODITIES[material]
    const spread = spot * 0.002
    const margin = PLATFORM_MARGIN[material]
    return {
      material,
      label:          cfg.label,
      exchange:       cfg.exchange,
      grade:          cfg.grade,
      unit:           cfg.unit,
      spot:           Math.round(spot * 100) / 100,
      bid:            Math.round((spot - spread) * 100) / 100,
      ask:            Math.round((spot + spread) * 100) / 100,
      open,
      high:           spot,
      low:            spot,
      change_24h:     0,
      change_pct:     0,
      volume:         0,
      consumer_rate:  spotToConsumerRate(spot, margin),
      platform_margin: margin,
      timestamp,
    }
  }

  // Build 90-day daily history with random walk for charts
  #buildInitialHistory(material, cfg) {
    const history = []
    let price = cfg.base
    const now = Date.now()

    for (let i = 89; i >= 0; i--) {
      const ts   = new Date(now - i * 86400000).toISOString().slice(0, 10)
      const noise = (Math.random() * 2 - 1) * cfg.vol * price
      const drift = -cfg.mr * (price - cfg.base)
      price = Math.max(1, price + noise + drift)
      history.push({ price: Math.round(price * 100) / 100, date: ts, timestamp: ts })
    }
    return history
  }

  start(intervalMs = 8000) {
    if (this.#running) return this
    this.#running = true
    this.#timer   = setInterval(() => this.#tick(), intervalMs)
    return this
  }

  #tick() {
    this.#tickCount++
    const now = new Date().toISOString()

    for (const [material, cfg] of Object.entries(COMMODITIES)) {
      const current = this.#prices[material]

      // Ornstein-Uhlenbeck step
      const deviation = (current.spot - cfg.base) / cfg.base
      const drift     = -cfg.mr * deviation
      const noise     = cfg.vol * (Math.random() * 2 - 1) * Math.sqrt(8 / 86400)  // ~8s tick
      const newSpot   = Math.max(1, current.spot * (1 + drift + noise))
      const spread    = newSpot * 0.002
      const margin    = PLATFORM_MARGIN[material]

      const updated = {
        ...current,
        spot:          Math.round(newSpot * 100) / 100,
        bid:           Math.round((newSpot - spread) * 100) / 100,
        ask:           Math.round((newSpot + spread) * 100) / 100,
        high:          Math.max(current.high, newSpot),
        low:           Math.min(current.low,  newSpot),
        change_24h:    Math.round((newSpot - current.open) * 100) / 100,
        change_pct:    Math.round(((newSpot - current.open) / current.open) * 10000) / 100,
        volume:        current.volume + Math.round(Math.random() * 3),
        consumer_rate: spotToConsumerRate(newSpot, margin),
        timestamp:     now,
      }

      this.#prices[material] = updated

      // Append to intraday history (keep 500 points)
      this.#history[material].push({ price: updated.spot, timestamp: now })
      if (this.#history[material].length > 500) this.#history[material].shift()

      this.#notify(material, updated)
    }

    // Occasionally publish a price update event
    if (this.#tickCount % 5 === 0) {
      bus.publish('pricing.updated', { source: 'market_feed', tick: this.#tickCount })
    }
  }

  #notify(material, record) {
    const handlers = this.#subs.get(material)
    if (handlers) for (const h of handlers) try { h({ ...record }) } catch {}
    for (const h of this.#globalSubs)       try { h({ ...record }) } catch {}
  }

  // Subscribe to one material or all (material = null).
  // Returns an unsubscribe function.
  subscribe(materialOrNull, handler) {
    if (materialOrNull === null) {
      this.#globalSubs.add(handler)
      for (const p of Object.values(this.#prices)) handler({ ...p })
      return () => this.#globalSubs.delete(handler)
    }
    if (!this.#subs.has(materialOrNull)) this.#subs.set(materialOrNull, new Set())
    this.#subs.get(materialOrNull).add(handler)
    if (this.#prices[materialOrNull]) handler({ ...this.#prices[materialOrNull] })
    return () => this.#subs.get(materialOrNull)?.delete(handler)
  }

  getPrice(material)      { return this.#prices[material]  ? { ...this.#prices[material]  } : null }
  getAllPrices()           { return Object.fromEntries(Object.entries(this.#prices).map(([k, v]) => [k, { ...v }])) }
  getHistory(material, n) { return (this.#history[material] || []).slice(-(n ?? 90)) }
  getAllHistory()          { return Object.fromEntries(Object.entries(this.#history).map(([k, v]) => [k, [...v]])) }

  // Snapshot for tables — array of price records
  snapshot() { return Object.values(this.#prices).map(p => ({ ...p })) }

  stop() {
    if (this.#timer) { clearInterval(this.#timer); this.#timer = null }
    this.#running = false
  }

  get isRunning()  { return this.#running }
  get tickCount()  { return this.#tickCount }
}

export const marketFeed = new MarketFeed()
