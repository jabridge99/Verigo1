import { can } from '../lib/rbac.js'

const PTS_TO_AUD = 0.05
const LARGE_PAYOUT_THRESHOLD_AUD = 500
const PAYOUT_ABUSE_LIMIT = 5
const PAYOUT_ABUSE_WINDOW_MS = 48 * 60 * 60 * 1000

function ptsToAud(pts) {
  return pts * PTS_TO_AUD
}

function shouldAutoHold(amountPts, { hasActiveFraudCase = false, recentPayoutCount = 0 } = {}) {
  const amountAud = ptsToAud(amountPts)
  if (amountAud > LARGE_PAYOUT_THRESHOLD_AUD) return { held: true, reason: 'large_payout' }
  if (hasActiveFraudCase) return { held: true, reason: 'active_fraud_case' }
  if (recentPayoutCount > PAYOUT_ABUSE_LIMIT) return { held: true, reason: 'payout_abuse' }
  return { held: false, reason: null }
}

function isPayoutAbuseTriggered(payoutTimestamps) {
  const cutoff = Date.now() - PAYOUT_ABUSE_WINDOW_MS
  const recent = payoutTimestamps.filter(t => t > cutoff)
  return recent.length > PAYOUT_ABUSE_LIMIT
}

function validatePayoutRequest({ userId, amountPts }) {
  if (!userId) throw new Error('userId is required')
  if (typeof amountPts !== 'number' || amountPts <= 0) throw new Error('amountPts must be a positive number')
}

const idempotencyStore = new Map()

function requestWithIdempotency(key, fn) {
  if (idempotencyStore.has(key)) return idempotencyStore.get(key)
  const result = fn()
  idempotencyStore.set(key, result)
  return result
}

function generateRequestKey(namespace, userId, amountPts) {
  return `${namespace}:${userId}:${amountPts}:${crypto.randomUUID()}`
}

describe('Points to AUD conversion', () => {
  it('converts 1000 pts to $50 AUD', () => {
    expect(ptsToAud(1000)).toBe(50)
  })

  it('converts 100 pts to $5 AUD', () => {
    expect(ptsToAud(100)).toBe(5)
  })

  it('handles fractional result correctly', () => {
    expect(ptsToAud(1)).toBeCloseTo(0.05, 10)
  })
})

describe('Auto-hold rules', () => {
  it('auto-holds payout above $500 AUD threshold', () => {
    const result = shouldAutoHold(10001)
    expect(result.held).toBe(true)
  })

  it('does not hold payout below threshold', () => {
    const result = shouldAutoHold(9999)
    expect(result.held).toBe(false)
  })

  it('auto-holds when user has active fraud case', () => {
    const result = shouldAutoHold(100, { hasActiveFraudCase: true })
    expect(result.held).toBe(true)
  })
})

describe('Payout abuse detection', () => {
  it('triggers hold when payout_count exceeds 5 in 48h', () => {
    const now = Date.now()
    const timestamps = Array.from({ length: 6 }, (_, i) => now - i * 1000)
    expect(isPayoutAbuseTriggered(timestamps)).toBe(true)
  })

  it('does not trigger at exactly 5 payouts', () => {
    const now = Date.now()
    const timestamps = Array.from({ length: 5 }, (_, i) => now - i * 1000)
    expect(isPayoutAbuseTriggered(timestamps)).toBe(false)
  })

  it('resets window after 48h', () => {
    const oldTimestamp = Date.now() - PAYOUT_ABUSE_WINDOW_MS - 1000
    const timestamps = Array.from({ length: 6 }, () => oldTimestamp)
    expect(isPayoutAbuseTriggered(timestamps)).toBe(false)
  })
})

describe('Idempotency', () => {
  beforeEach(() => {
    idempotencyStore.clear()
  })

  it('returns same result for duplicate idempotency key', () => {
    const key = 'payout:user-1:1000:fixed-key'
    const first = requestWithIdempotency(key, () => ({ requestId: 'req-abc', status: 'pending' }))
    const second = requestWithIdempotency(key, () => ({ requestId: 'req-different', status: 'held' }))
    expect(second).toStrictEqual(first)
    expect(second.requestId).toBe('req-abc')
  })

  it('generates unique idempotency key per request', () => {
    const key1 = generateRequestKey('payout', 'user-1', 1000)
    const key2 = generateRequestKey('payout', 'user-1', 1000)
    expect(key1).not.toBe(key2)
  })
})

describe('Validation', () => {
  it('rejects zero amount', () => {
    expect(() => validatePayoutRequest({ userId: 'user-1', amountPts: 0 })).toThrow()
  })

  it('rejects negative amount', () => {
    expect(() => validatePayoutRequest({ userId: 'user-1', amountPts: -100 })).toThrow()
  })

  it('rejects missing userId', () => {
    expect(() => validatePayoutRequest({ userId: null, amountPts: 100 })).toThrow()
  })
})

describe('RBAC', () => {
  it('allows payout_approver to approve', () => {
    expect(can('payout_approver', 'approve:payout')).toBe(true)
  })

  it('denies consumer from approving', () => {
    expect(can('consumer', 'approve:payout')).toBe(false)
  })

  it('allows treasurer to release', () => {
    expect(can('treasurer', 'release:payout')).toBe(true)
  })
})
