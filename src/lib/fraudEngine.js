// Fraud detection rules engine
// Evaluates events against a rule set, computes a weighted risk score 0–100,
// and recommends an action (allow / manual_review / hold_payout / reject / suspend).

import { bus } from './eventBus'
import { audit, AUDIT_ACTIONS } from './audit'

// ── Signal catalogue ──────────────────────────────────────────────────────────

export const SIGNAL = {
  DUPLICATE_SCAN:          { weight: 25, label: 'Duplicate scan',           ttl_hours: 1  },
  FAKE_DEPOSIT:            { weight: 35, label: 'Fake deposit suspected',   ttl_hours: 24 },
  ABNORMAL_WEIGHT:         { weight: 20, label: 'Abnormal weight',          ttl_hours: 24 },
  GPS_MISMATCH:            { weight: 30, label: 'GPS mismatch',             ttl_hours: 1  },
  REFERRAL_ABUSE:          { weight: 25, label: 'Referral abuse',           ttl_hours: 168 },
  PAYOUT_ABUSE:            { weight: 30, label: 'Payout abuse',             ttl_hours: 72 },
  SUSPICIOUS_OPERATOR:     { weight: 20, label: 'Suspicious operator',      ttl_hours: 48 },
  RAPID_DEPOSITS:          { weight: 15, label: 'Rapid deposit pattern',    ttl_hours: 1  },
  DEVICE_FINGERPRINT:      { weight: 20, label: 'Device fingerprint match', ttl_hours: 720 },
  ACCOUNT_AGE_LOW:         { weight: 10, label: 'New account',              ttl_hours: null },
  HIGH_VALUE_WITHDRAWAL:   { weight: 15, label: 'High-value withdrawal',    ttl_hours: 24 },
}

// ── Thresholds → action ───────────────────────────────────────────────────────

export const RISK_ACTION = {
  allow:         { min: 0,   max: 24,  label: 'Allow',         color: 'eco'    },
  manual_review: { min: 25,  max: 49,  label: 'Manual Review', color: 'amber'  },
  hold_payout:   { min: 50,  max: 74,  label: 'Hold Payout',   color: 'orange' },
  reject:        { min: 75,  max: 89,  label: 'Reject',        color: 'red'    },
  suspend:       { min: 90,  max: 100, label: 'Suspend',       color: 'red'    },
}

export function getAction(score) {
  return Object.entries(RISK_ACTION).find(([, v]) => score >= v.min && score <= v.max)?.[0] ?? 'allow'
}

export function getRiskLevel(score) {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

// ── Rules ─────────────────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'R001', name: 'Duplicate station scan within 1h',
    signal: 'DUPLICATE_SCAN', threshold: 1, multiplier: 1.0,
    description: 'Same QR code scanned twice within the TTL window',
  },
  {
    id: 'R002', name: 'GPS >500m from station',
    signal: 'GPS_MISMATCH', threshold: 1, multiplier: 1.0,
    description: 'Deposit GPS coordinates do not match station location',
  },
  {
    id: 'R003', name: 'Weight >3× station average',
    signal: 'ABNORMAL_WEIGHT', threshold: 1, multiplier: 1.0,
    description: 'Deposit weight is implausibly high for the material type',
  },
  {
    id: 'R004', name: '5+ referrals in 24h from same device',
    signal: 'REFERRAL_ABUSE', threshold: 1, multiplier: 1.0,
    description: 'Self-referral or referral ring suspected',
  },
  {
    id: 'R005', name: 'Withdrawal >80% of wallet within 24h of deposit',
    signal: 'PAYOUT_ABUSE', threshold: 1, multiplier: 1.0,
    description: 'Rapid deposit-then-withdraw cycle',
  },
  {
    id: 'R006', name: '3+ deposits in 10 minutes',
    signal: 'RAPID_DEPOSITS', threshold: 3, multiplier: 0.8,
    description: 'Automated deposit pattern detected',
  },
  {
    id: 'R007', name: 'Known fraudulent device fingerprint',
    signal: 'DEVICE_FINGERPRINT', threshold: 1, multiplier: 1.5,
    description: 'Device previously linked to fraudulent account',
  },
]

// ── Engine ────────────────────────────────────────────────────────────────────

class FraudEngine {
  #signals   = new Map()   // entityId → [{...signal, expires_at}]
  #scores    = new Map()   // entityId → last evaluation result
  #caseCount = 0

  // Add a signal and re-evaluate the entity
  addSignal(entityId, signalType, data = {}, actor = 'system') {
    if (!SIGNAL[signalType]) throw new Error(`Unknown signal type: ${signalType}`)

    const def = SIGNAL[signalType]
    const now = Date.now()
    const expires_at = def.ttl_hours ? new Date(now + def.ttl_hours * 3600000).toISOString() : null

    const sig = {
      id: `SIG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityId, signalType, weight: def.weight,
      data, actor, expires_at,
      created_at: new Date().toISOString(),
    }

    if (!this.#signals.has(entityId)) this.#signals.set(entityId, [])
    this.#signals.get(entityId).push(sig)

    const result = this.#evaluate(entityId)

    void audit(AUDIT_ACTIONS.RISK_SIGNAL_RAISED, { actor, entityId, after: { signalType, score: result.score, action: result.action } })

    if (result.score >= 50) {
      bus.publish('fraud.signal.raised', { entityId, signalType, score: result.score, action: result.action })
    }
    if (result.score >= 90) {
      bus.publish('fraud.entity.suspended', { entityId, score: result.score, signals: result.signals.map(s => s.signalType) })
    }

    return result
  }

  #evaluate(entityId) {
    const now = new Date().toISOString()
    const allSignals = (this.#signals.get(entityId) || [])
      .filter(s => !s.expires_at || s.expires_at > now)

    // Update stored signals (drop expired)
    this.#signals.set(entityId, allSignals)

    // Evaluate each rule
    const triggered = []
    let rawScore = 0

    for (const rule of RULES) {
      const matching = allSignals.filter(s => s.signalType === rule.signal)
      if (matching.length >= rule.threshold) {
        const def = SIGNAL[rule.signal]
        const contribution = def.weight * rule.multiplier
        rawScore += contribution
        triggered.push({ ...rule, matching_count: matching.length, contribution })
      }
    }

    const score    = Math.min(100, Math.round(rawScore))
    const action   = getAction(score)
    const level    = getRiskLevel(score)
    const result   = { entityId, score, level, action, triggered_rules: triggered, signals: allSignals, evaluated_at: now }

    this.#scores.set(entityId, result)
    return result
  }

  // Evaluate a deposit event inline (returns assessment without persisting if score = 0)
  evaluateDeposit({ userId, stationId, weightKg, gpsLat, gpsLng, stationLat, stationLng, materialType }) {
    const signals = []

    if (weightKg > 50) signals.push({ type: 'ABNORMAL_WEIGHT', data: { weightKg, threshold: 50 } })

    if (stationLat != null && gpsLat != null) {
      const dlat = gpsLat - stationLat
      const dlng = gpsLng - stationLng
      const distM = Math.sqrt(dlat * dlat + dlng * dlng) * 111320
      if (distM > 500) signals.push({ type: 'GPS_MISMATCH', data: { distanceM: Math.round(distM) } })
    }

    let result = this.getScore(userId)
    for (const s of signals) {
      result = this.addSignal(userId, s.type, s.data, 'fraud_engine')
    }
    return result
  }

  evaluateWithdrawal({ userId, amountAud, walletBalanceAud }) {
    const pct = walletBalanceAud > 0 ? amountAud / walletBalanceAud : 0
    if (pct >= 0.8 && amountAud >= 50) {
      return this.addSignal(userId, 'PAYOUT_ABUSE', { amountAud, pct: Math.round(pct * 100) }, 'fraud_engine')
    }
    return this.getScore(userId)
  }

  getScore(entityId) {
    return this.#scores.get(entityId) ?? { entityId, score: 0, level: 'low', action: 'allow', triggered_rules: [], signals: [] }
  }

  getAllAlerts(minScore = 25) {
    return [...this.#scores.values()]
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
  }

  openCase(entityId, actor = 'system') {
    const score = this.getScore(entityId)
    const caseId = `CASE-${String(++this.#caseCount).padStart(4, '0')}`
    bus.publish('fraud.case.opened', { caseId, entityId, score: score.score, actor })
    void audit(AUDIT_ACTIONS.FRAUD_CASE_OPENED, { actor, entityId: caseId, after: { entityId, score } })
    return caseId
  }

  resolveCase(caseId, resolution, actor = 'system') {
    bus.publish('fraud.case.resolved', { caseId, resolution, actor })
    void audit(AUDIT_ACTIONS.FRAUD_CASE_RESOLVED, { actor, entityId: caseId, after: { resolution } })
  }

  // Seed with demo signals for existing mock entities
  seed() {
    this.addSignal('USR-00842', 'DUPLICATE_SCAN',    { station: 'ST-001' }, 'seed')
    this.addSignal('USR-00842', 'GPS_MISMATCH',      { distanceM: 820 },   'seed')
    this.addSignal('USR-01194', 'PAYOUT_ABUSE',      { amountAud: 180 },   'seed')
    this.addSignal('USR-01194', 'RAPID_DEPOSITS',    { count: 4 },         'seed')
    this.addSignal('OPR-00031', 'SUSPICIOUS_OPERATOR',{ pattern: 'volume_spike' }, 'seed')
    this.addSignal('USR-00305', 'REFERRAL_ABUSE',    { count: 6 },         'seed')
    this.addSignal('USR-00305', 'DEVICE_FINGERPRINT',{ deviceId: 'DEV-88' },'seed')
    return this
  }
}

export const fraudEngine = new FraudEngine()
fraudEngine.seed()
