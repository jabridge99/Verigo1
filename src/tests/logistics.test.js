function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function validateDepositWeight(claimedKg, actualKg, itemType) {
  const baselines = { smartphone: 0.24, laptop: 2.1, tablet: 0.52, desktop: 8.0, cable: 0.3 }
  const baseline     = baselines[itemType] ?? 1.0
  const sigmaApprox  = baseline * 0.25
  const zScore       = Math.abs(actualKg - baseline) / sigmaApprox
  return { valid: zScore <= 3, zScore: parseFloat(zScore.toFixed(2)), baseline, sigmaApprox }
}

function routeEfficiency(scheduledKm, actualKm) {
  return parseFloat(((scheduledKm / actualKm) * 100).toFixed(1))
}

function contractorUtilisation(activeContractors, totalContractors) {
  if (totalContractors === 0) return 0
  return (activeContractors / totalContractors) * 100
}

function isPickupOverdue(scheduledAtMs, avgWaitHours) {
  const elapsedHours = (Date.now() - scheduledAtMs) / (1000 * 60 * 60)
  return elapsedHours > avgWaitHours
}

describe('GPS distance calculation', () => {
  it('returns 0 for identical coordinates', () => {
    const dist = haversineDistanceM(-33.8688, 151.2093, -33.8688, 151.2093)
    expect(dist).toBeCloseTo(0, 1)
  })

  it('correctly calculates distance within a city', () => {
    const dist = haversineDistanceM(-33.8688, 151.2093, -33.8708, 151.2113)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(5000)
  })

  it('flags distances > 200m as GPS mismatch', () => {
    const dist = haversineDistanceM(-33.8688, 151.2093, -33.8706, 151.2093)
    expect(dist).toBeGreaterThan(200)
    expect(dist > 200).toBe(true)
  })

  it('does not flag distances ≤ 200m', () => {
    const dist = haversineDistanceM(-33.8688, 151.2093, -33.8703, 151.2093)
    expect(dist <= 200).toBe(true)
  })
})

describe('Weight validation', () => {
  it('passes for weight within 3 sigma of baseline', () => {
    const result = validateDepositWeight(0.28, 0.28, 'smartphone')
    expect(result.valid).toBe(true)
  })

  it('fails for weight > 3 sigma above baseline', () => {
    const result = validateDepositWeight(1.5, 1.5, 'smartphone')
    expect(result.valid).toBe(false)
    expect(result.zScore).toBeGreaterThan(3)
  })

  it('fails for extremely heavy laptop', () => {
    const result = validateDepositWeight(15, 15, 'laptop')
    expect(result.valid).toBe(false)
  })

  it('uses 1.0kg default baseline for unknown item type', () => {
    const result = validateDepositWeight(1.0, 1.0, 'unknown')
    expect(result.baseline).toBe(1.0)
  })
})

describe('Route efficiency', () => {
  it('returns 100% for exactly on-route', () => {
    expect(routeEfficiency(50, 50)).toBe(100.0)
  })

  it('returns < 100% for longer-than-planned route', () => {
    expect(routeEfficiency(50, 60)).toBeCloseTo(83.3, 1)
  })

  it('returns > 100% for shorter-than-planned route (better than expected)', () => {
    expect(routeEfficiency(60, 50)).toBe(120.0)
  })
})

describe('Contractor utilisation', () => {
  it('calculates utilisation correctly', () => {
    expect(contractorUtilisation(78, 100)).toBe(78)
  })

  it('handles full utilisation', () => {
    expect(contractorUtilisation(100, 100)).toBe(100)
  })

  it('handles zero contractors gracefully', () => {
    expect(contractorUtilisation(0, 0)).toBe(0)
  })
})

describe('Pickup queue', () => {
  it('identifies overdue pickups', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
    expect(isPickupOverdue(threeHoursAgo, 2.4)).toBe(true)
  })

  it('does not flag on-time pickups as overdue', () => {
    const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000
    expect(isPickupOverdue(oneHourAgo, 2.4)).toBe(false)
  })
})
