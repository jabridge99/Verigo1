const SIGNAL_WEIGHTS = {
  duplicate_scan: 18,
  fake_deposit: 25,
  abnormal_weight: 20,
  gps_mismatch: 15,
  referral_abuse: 22,
  payout_abuse: 20,
  suspicious_operator: 30,
}

const SIGNAL_THRESHOLDS = {
  duplicate_scan:      { scan_count: 2, window_hrs: 24 },
  fake_deposit:        { deviation_pct: 40 },
  gps_mismatch:        { distance_m: 200 },
  referral_abuse:      { referral_count: 8, window_days: 7 },
  payout_abuse:        { payout_count: 5, window_hrs: 48 },
  suspicious_operator: { flag: true },
  abnormal_weight:     { z_score: 3 },
}

function evaluateSignal(type, evidence) {
  const weight = SIGNAL_WEIGHTS[type]
  const threshold = SIGNAL_THRESHOLDS[type]

  if (type === 'duplicate_scan') {
    const triggered = evidence.scan_count > threshold.scan_count
    let severity = 'low'
    if (triggered) severity = 'high'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'fake_deposit') {
    const triggered = evidence.deviation_pct > threshold.deviation_pct
    let severity = 'medium'
    if (evidence.deviation_pct > 80) severity = 'critical'
    else if (evidence.deviation_pct > 60) severity = 'high'
    else if (triggered) severity = 'medium'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'gps_mismatch') {
    const triggered = evidence.distance_m > threshold.distance_m
    let severity = 'low'
    if (evidence.distance_m > 1000) severity = 'high'
    else if (evidence.distance_m > 500) severity = 'medium'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'referral_abuse') {
    const triggered = evidence.circular === true || evidence.referral_count > threshold.referral_count
    const severity = triggered ? 'high' : 'low'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'payout_abuse') {
    const triggered = evidence.payout_count > threshold.payout_count
    const severity = triggered ? 'medium' : 'low'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'suspicious_operator') {
    const triggered = evidence.flag === true
    const severity = triggered ? 'critical' : 'low'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  if (type === 'abnormal_weight') {
    const triggered = evidence.z_score > threshold.z_score
    const severity = triggered ? 'high' : 'low'
    return { triggered, severity, score_contribution: triggered ? weight : 0 }
  }

  return { triggered: false, severity: 'low', score_contribution: 0 }
}

function calculateRiskScore(triggeredSignals) {
  const total = triggeredSignals.reduce((sum, s) => sum + (SIGNAL_WEIGHTS[s] ?? 0), 0)
  return Math.min(100, total)
}

function riskLevel(score) {
  if (score <= 25) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 75) return 'high'
  return 'critical'
}

describe('evaluateSignal — Duplicate Scan', () => {
  it('triggers when scan_count exceeds threshold', () => {
    const result = evaluateSignal('duplicate_scan', { scan_count: 3, window_hrs: 24 })
    expect(result.triggered).toBe(true)
  })

  it('does not trigger below threshold', () => {
    const result = evaluateSignal('duplicate_scan', { scan_count: 2, window_hrs: 24 })
    expect(result.triggered).toBe(false)
  })

  it('assigns correct severity and score_contribution', () => {
    const result = evaluateSignal('duplicate_scan', { scan_count: 3, window_hrs: 24 })
    expect(result.severity).toBe('high')
    expect(result.score_contribution).toBe(18)
  })
})

describe('evaluateSignal — Fake Deposit', () => {
  it('triggers on composition deviation > 40%', () => {
    const result = evaluateSignal('fake_deposit', { deviation_pct: 45 })
    expect(result.triggered).toBe(true)
  })

  it('does not trigger at exactly 40%', () => {
    const result = evaluateSignal('fake_deposit', { deviation_pct: 40 })
    expect(result.triggered).toBe(false)
  })

  it('assigns critical severity above 80% deviation', () => {
    const result = evaluateSignal('fake_deposit', { deviation_pct: 85 })
    expect(result.severity).toBe('critical')
  })
})

describe('evaluateSignal — GPS Mismatch', () => {
  it('triggers when distance exceeds 200m', () => {
    const result = evaluateSignal('gps_mismatch', { distance_m: 250 })
    expect(result.triggered).toBe(true)
  })

  it('assigns low severity below 500m', () => {
    const result = evaluateSignal('gps_mismatch', { distance_m: 300 })
    expect(result.severity).toBe('low')
  })

  it('assigns high severity above 1000m', () => {
    const result = evaluateSignal('gps_mismatch', { distance_m: 1200 })
    expect(result.severity).toBe('high')
  })
})

describe('calculateRiskScore', () => {
  it('returns 0 for no signals', () => {
    expect(calculateRiskScore([])).toBe(0)
  })

  it('caps at 100 for all signals triggered', () => {
    const all = Object.keys(SIGNAL_WEIGHTS)
    expect(calculateRiskScore(all)).toBe(100)
  })

  it('correctly weights multiple signals', () => {
    expect(calculateRiskScore(['duplicate_scan', 'referral_abuse'])).toBe(40)
  })

  it('caps partial score correctly', () => {
    const score = calculateRiskScore(['fake_deposit', 'suspicious_operator', 'payout_abuse'])
    expect(score).toBe(75)
  })
})

describe('Fraud case thresholds', () => {
  it('risk level is low for score 0-25', () => {
    expect(riskLevel(20)).toBe('low')
  })

  it('risk level is medium for score 26-50', () => {
    expect(riskLevel(40)).toBe('medium')
  })

  it('risk level is high for score 51-75', () => {
    expect(riskLevel(65)).toBe('high')
  })

  it('risk level is critical for score 76-100', () => {
    expect(riskLevel(82)).toBe('critical')
  })
})

describe('Referral abuse', () => {
  it('triggers for self-referral', () => {
    const result = evaluateSignal('referral_abuse', { referral_count: 9, window_days: 7 })
    expect(result.triggered).toBe(true)
  })

  it('detects circular referral chain', () => {
    const result = evaluateSignal('referral_abuse', { circular: true, referral_count: 1 })
    expect(result.triggered).toBe(true)
  })
})
