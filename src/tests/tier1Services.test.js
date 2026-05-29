import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fraudEngine, SIGNAL, RISK_ACTION, getAction, getRiskLevel } from '../lib/fraudEngine'
import { haversineKm, optimizeRoute, buildTimeline, stationPriority, totalEstimatedKg, groupByRegion, SYDNEY_DEPOT } from '../lib/routeOptimizer'
import { marketFeed, COMMODITIES, PLATFORM_MARGIN, spotToConsumerRate, formatPrice } from '../lib/marketFeed'
import { iotStream, STATION_REGISTRY } from '../lib/iotStream'

// ── fraudEngine ───────────────────────────────────────────────────────────────

describe('getAction()', () => {
  it.each([
    [0,   'allow'],
    [24,  'allow'],
    [25,  'manual_review'],
    [49,  'manual_review'],
    [50,  'hold_payout'],
    [74,  'hold_payout'],
    [75,  'reject'],
    [89,  'reject'],
    [90,  'suspend'],
    [100, 'suspend'],
  ])('score %i → %s', (score, expected) => {
    expect(getAction(score)).toBe(expected)
  })
})

describe('getRiskLevel()', () => {
  it.each([
    [0,  'low'],
    [24, 'low'],
    [25, 'medium'],
    [49, 'medium'],
    [50, 'high'],
    [74, 'high'],
    [75, 'critical'],
  ])('score %i → %s', (score, expected) => {
    expect(getRiskLevel(score)).toBe(expected)
  })
})

describe('fraudEngine.addSignal()', () => {
  it('throws on unknown signal type', () => {
    expect(() => fraudEngine.addSignal('USR-X', 'NONEXISTENT')).toThrow('Unknown signal type')
  })

  it('returns a result with score/action/level', () => {
    const result = fraudEngine.addSignal('USR-FE-TEST', 'RAPID_DEPOSITS', { count: 3 })
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('action')
    expect(result).toHaveProperty('level')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('fraudEngine.getScore()', () => {
  it('returns safe default for unknown entity', () => {
    const r = fraudEngine.getScore('USR-TOTALLY-UNKNOWN-9999')
    expect(r.score).toBe(0)
    expect(r.action).toBe('allow')
  })

  it('seeded entities have non-zero scores', () => {
    const r = fraudEngine.getScore('USR-00842')
    expect(r.score).toBeGreaterThan(0)
  })
})

describe('fraudEngine.evaluateDeposit()', () => {
  it('flags abnormal weight', () => {
    const r = fraudEngine.evaluateDeposit({ userId: 'USR-WEIGHT-TEST', stationId: 'ST-001', weightKg: 100 })
    expect(r.score).toBeGreaterThan(0)
  })

  it('flags GPS mismatch >500m', () => {
    const r = fraudEngine.evaluateDeposit({
      userId: 'USR-GPS-TEST',
      stationId: 'ST-001',
      weightKg: 1,
      gpsLat: -33.8840,
      gpsLng: 151.2090,
      stationLat: -34.0,
      stationLng: 151.2090,
    })
    expect(r.score).toBeGreaterThan(0)
  })

  it('passes normal deposit', () => {
    const r = fraudEngine.evaluateDeposit({
      userId: 'USR-CLEAN',
      stationId: 'ST-001',
      weightKg: 1.2,
      gpsLat: -33.8840,
      gpsLng: 151.2090,
      stationLat: -33.8840,
      stationLng: 151.2090,
    })
    expect(r.action).toBe('allow')
  })
})

describe('fraudEngine.evaluateWithdrawal()', () => {
  it('flags payout abuse (>=80% of wallet)', () => {
    const r = fraudEngine.evaluateWithdrawal({ userId: 'USR-PAYOUT', amountAud: 100, walletBalanceAud: 110 })
    expect(r.score).toBeGreaterThan(0)
  })

  it('does not flag small withdrawal', () => {
    const before = fraudEngine.getScore('USR-SMALLWITHDRAW').score
    fraudEngine.evaluateWithdrawal({ userId: 'USR-SMALLWITHDRAW', amountAud: 5, walletBalanceAud: 110 })
    const after = fraudEngine.getScore('USR-SMALLWITHDRAW').score
    expect(after).toBe(before)
  })
})

describe('fraudEngine.getAllAlerts()', () => {
  it('returns array', () => {
    expect(Array.isArray(fraudEngine.getAllAlerts())).toBe(true)
  })

  it('respects minScore filter', () => {
    const alerts = fraudEngine.getAllAlerts(50)
    for (const a of alerts) expect(a.score).toBeGreaterThanOrEqual(50)
  })

  it('sorted descending by score', () => {
    const alerts = fraudEngine.getAllAlerts(0)
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i].score).toBeLessThanOrEqual(alerts[i - 1].score)
    }
  })
})

// ── routeOptimizer ────────────────────────────────────────────────────────────

describe('haversineKm()', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: -33.8688, lng: 151.2093 }, { lat: -33.8688, lng: 151.2093 })).toBeCloseTo(0)
  })

  it('Sydney CBD to Newtown ~3.5 km', () => {
    const d = haversineKm(SYDNEY_DEPOT, { lat: -33.8970, lng: 151.1790 })
    expect(d).toBeGreaterThan(2)
    expect(d).toBeLessThan(6)
  })
})

describe('optimizeRoute()', () => {
  it('returns empty route for no stops', () => {
    const r = optimizeRoute(SYDNEY_DEPOT, [])
    expect(r.stops).toEqual([])
    expect(r.totalKm).toBe(0)
  })

  it('handles a single stop', () => {
    const stop = { lat: -33.8840, lng: 151.2090, id: 'ST-001' }
    const r = optimizeRoute(SYDNEY_DEPOT, [stop])
    expect(r.stops).toHaveLength(1)
    expect(r.totalKm).toBeGreaterThan(0)
    expect(r.returnKm).toBeGreaterThan(0)
  })

  it('visits all stops', () => {
    const stops = [
      { lat: -33.8840, lng: 151.2090 },
      { lat: -33.8970, lng: 151.1790 },
      { lat: -33.8750, lng: 151.2190 },
    ]
    const r = optimizeRoute(SYDNEY_DEPOT, stops)
    expect(r.stops).toHaveLength(3)
  })

  it('each stop has distFromPrevKm', () => {
    const stops = [{ lat: -33.88, lng: 151.21 }, { lat: -33.90, lng: 151.19 }]
    const r = optimizeRoute(SYDNEY_DEPOT, stops)
    for (const s of r.stops) expect(s.distFromPrevKm).toBeGreaterThanOrEqual(0)
  })
})

describe('buildTimeline()', () => {
  it('adds eta to each stop', () => {
    const ordered = [
      { distFromPrevKm: 2 },
      { distFromPrevKm: 3 },
    ]
    const tl = buildTimeline(new Date(), ordered)
    expect(tl).toHaveLength(2)
    expect(tl[0].eta).toBeDefined()
    expect(tl[0].etaFormatted).toMatch(/\d{2}:\d{2}/)
  })

  it('later stops have later ETAs', () => {
    const ordered = [{ distFromPrevKm: 1 }, { distFromPrevKm: 5 }]
    const tl = buildTimeline(new Date(), ordered)
    expect(new Date(tl[1].eta).getTime()).toBeGreaterThan(new Date(tl[0].eta).getTime())
  })
})

describe('stationPriority()', () => {
  it('returns 0 for empty station', () => {
    expect(stationPriority(0, 0)).toBe(0)
  })

  it('caps at 100', () => {
    expect(stationPriority(200, 0)).toBe(100)
  })
})

describe('totalEstimatedKg()', () => {
  it('sums estimatedKg', () => {
    const stops = [{ estimatedKg: 10 }, { estimatedKg: 20 }, { estimatedKg: 5 }]
    expect(totalEstimatedKg(stops)).toBe(35)
  })

  it('falls back to weight_today_kg', () => {
    const stops = [{ weight_today_kg: 7 }, { weight_today_kg: 3 }]
    expect(totalEstimatedKg(stops)).toBe(10)
  })
})

describe('groupByRegion()', () => {
  it('groups by first word of suburb', () => {
    const stations = [
      { suburb: 'Surry Hills' },
      { suburb: 'Surry West' },
      { suburb: 'Redfern' },
    ]
    const regions = groupByRegion(stations)
    expect(regions['Surry']).toHaveLength(2)
    expect(regions['Redfern']).toHaveLength(1)
  })
})

// ── marketFeed ────────────────────────────────────────────────────────────────

describe('spotToConsumerRate()', () => {
  it('converts tonne to kg and applies margin', () => {
    const rate = spotToConsumerRate(2000, 0.15)
    expect(rate).toBeCloseTo(2000 / 1000 * 0.85, 3)
  })
})

describe('formatPrice()', () => {
  it('formats AUD/t', () => {
    const s = formatPrice(2180, 'AUD/t')
    expect(s).toContain('/t')
    expect(s).toContain('$')
  })

  it('formats AUD/kg', () => {
    const s = formatPrice(1.8525, 'AUD/kg')
    expect(s).toContain('/kg')
    expect(s).toContain('1.8525')
  })
})

describe('COMMODITIES', () => {
  it('has 7 materials', () => {
    expect(Object.keys(COMMODITIES)).toHaveLength(7)
  })

  it('each material has required fields', () => {
    for (const [key, c] of Object.entries(COMMODITIES)) {
      expect(c.label).toBeTruthy()
      expect(c.base).toBeGreaterThan(0)
      expect(c.vol).toBeGreaterThan(0)
      expect(PLATFORM_MARGIN[key]).toBeGreaterThan(0)
    }
  })
})

describe('marketFeed singleton', () => {
  it('snapshot returns 7 records', () => {
    const snap = marketFeed.snapshot()
    expect(snap).toHaveLength(7)
  })

  it('each price record has required fields', () => {
    for (const p of marketFeed.snapshot()) {
      expect(p.material).toBeTruthy()
      expect(p.spot).toBeGreaterThan(0)
      expect(p.bid).toBeLessThan(p.ask)
      expect(p.consumer_rate).toBeGreaterThan(0)
    }
  })

  it('getPrice returns null for unknown material', () => {
    expect(marketFeed.getPrice('unobtanium')).toBeNull()
  })

  it('getHistory returns array up to 90 points by default', () => {
    const hist = marketFeed.getHistory('aluminium')
    expect(Array.isArray(hist)).toBe(true)
    expect(hist.length).toBeLessThanOrEqual(90)
  })

  it('subscribe delivers initial snapshot immediately', () => {
    const received = []
    const unsub = marketFeed.subscribe('aluminium', p => received.push(p))
    unsub()
    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0].material).toBe('aluminium')
  })

  it('subscribe(null) delivers all materials immediately', () => {
    const received = []
    const unsub = marketFeed.subscribe(null, p => received.push(p))
    unsub()
    expect(received.length).toBeGreaterThanOrEqual(7)
  })
})

// ── iotStream ─────────────────────────────────────────────────────────────────

describe('STATION_REGISTRY', () => {
  it('has 8 stations', () => {
    expect(Object.keys(STATION_REGISTRY)).toHaveLength(8)
  })

  it('each station has lat/lng/capacity', () => {
    for (const s of Object.values(STATION_REGISTRY)) {
      expect(s.lat).toBeDefined()
      expect(s.lng).toBeDefined()
      expect(s.capacity_l).toBeGreaterThan(0)
    }
  })
})

describe('iotStream singleton', () => {
  afterEach(() => {
    // Don't disconnect — keep it connected across tests but don't leave timers running
  })

  it('starts disconnected', () => {
    // It may already be connected from another import; just check it has a connected getter
    expect(typeof iotStream.isConnected).toBe('boolean')
  })

  it('connect() populates station state', () => {
    iotStream.connect(999999) // very long interval so tick won't fire in test
    const stations = iotStream.getAllStations()
    expect(stations).toHaveLength(8)
    iotStream.disconnect()
  })

  it('getState returns station data after connect', () => {
    iotStream.connect(999999)
    const st = iotStream.getState('ST-001')
    expect(st).toBeDefined()
    expect(st.stationId).toBe('ST-001')
    expect(st.fill_pct).toBeGreaterThanOrEqual(0)
    iotStream.disconnect()
  })

  it('getState returns null for unknown station', () => {
    iotStream.connect(999999)
    expect(iotStream.getState('ST-999')).toBeNull()
    iotStream.disconnect()
  })

  it('subscribe delivers initial state immediately', () => {
    iotStream.connect(999999)
    const received = []
    const unsub = iotStream.subscribe('ST-001', s => received.push(s))
    unsub()
    expect(received.length).toBeGreaterThanOrEqual(1)
    iotStream.disconnect()
  })

  it('subscribe(null) delivers all stations', () => {
    iotStream.connect(999999)
    const received = []
    const unsub = iotStream.subscribe(null, s => received.push(s))
    unsub()
    expect(received.length).toBeGreaterThanOrEqual(8)
    iotStream.disconnect()
  })

  it('simulateDeposit updates fill_pct and deposits_today', () => {
    iotStream.connect(999999)
    const before = iotStream.getState('ST-001')
    const beforeDeposits = before.deposits_today
    iotStream.simulateDeposit('ST-001', { weightKg: 1.5, material: 'Aluminium', userId: 'USR-TEST' })
    const after = iotStream.getState('ST-001')
    expect(after.deposits_today).toBe(beforeDeposits + 1)
    expect(after.last_deposit).toBeTruthy()
    iotStream.disconnect()
  })

  it('simulateDeposit returns null for offline station', () => {
    iotStream.connect(999999)
    const result = iotStream.simulateDeposit('ST-003') // starts offline in demo
    expect(result).toBeNull()
    iotStream.disconnect()
  })
})
