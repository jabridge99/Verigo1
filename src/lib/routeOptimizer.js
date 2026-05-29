// Route optimisation (nearest-neighbour TSP) + contractor scheduling
// Produces ordered pickup routes that minimise total travel distance.

// ── Geometry ──────────────────────────────────────────────────────────────────

export function haversineKm(a, b) {
  const R    = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const h    = Math.sin(dLat / 2) ** 2 +
               Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

// ── Nearest-neighbour TSP ─────────────────────────────────────────────────────

/**
 * Greedy nearest-neighbour heuristic.
 * @param {{ lat, lng }} depot  — starting/ending point
 * @param {Array}        stops  — objects with at least { lat, lng }
 * @returns {{ stops: Array, totalKm: number, returnKm: number }}
 */
export function optimizeRoute(depot, stops) {
  if (!stops.length) return { stops: [], totalKm: 0, returnKm: 0 }

  const unvisited = stops.map((s, i) => ({ ...s, _origIdx: i }))
  const ordered   = []
  let current = depot
  let totalKm = 0

  while (unvisited.length) {
    let nearestIdx  = 0
    let nearestDist = Infinity

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(current, unvisited[i])
      if (d < nearestDist) { nearestDist = d; nearestIdx = i }
    }

    const [nearest] = unvisited.splice(nearestIdx, 1)
    ordered.push({ ...nearest, distFromPrevKm: Math.round(nearestDist * 10) / 10 })
    totalKm += nearestDist
    current  = nearest
  }

  const returnKm = haversineKm(current, depot)
  totalKm       += returnKm

  return {
    stops:     ordered,
    totalKm:   Math.round(totalKm * 10) / 10,
    returnKm:  Math.round(returnKm * 10) / 10,
  }
}

// ── ETA timeline ──────────────────────────────────────────────────────────────

/**
 * Annotate each stop with an estimated arrival time.
 * @param {string|Date} startTime        — ISO string or Date
 * @param {Array}       orderedStops     — output from optimizeRoute
 * @param {number}      avgSpeedKmh      — default 30 km/h (urban)
 * @param {number}      serviceMinutes   — time spent at each stop
 */
export function buildTimeline(startTime, orderedStops, avgSpeedKmh = 30, serviceMinutes = 15) {
  const MS_PER_MIN = 60_000
  let t = new Date(startTime).getTime()

  return orderedStops.map((stop, i) => {
    if (i > 0) {
      const travelMins = (stop.distFromPrevKm / avgSpeedKmh) * 60
      t += travelMins * MS_PER_MIN
    }
    const eta = new Date(t)
    t += serviceMinutes * MS_PER_MIN

    return {
      ...stop,
      eta:           eta.toISOString(),
      etaFormatted:  eta.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
  })
}

// ── Contractor scheduler ──────────────────────────────────────────────────────

/**
 * Assign jobs to contractors and optimise each contractor's route.
 *
 * @param {Array} jobs        — { id, stationId, lat, lng, suburb, fillPct, priority, estimatedKg }
 * @param {Array} contractors — { id, name, coverage: string[], maxJobs, lat, lng }
 * @param {Date}  startTime   — when routes begin
 * @param {{ lat, lng }} depot — shared depot for route start/end
 * @returns {Array} assignments — one entry per contractor with route + stats
 */
export function scheduleContractors(jobs, contractors, startTime = new Date(), depot = SYDNEY_DEPOT) {
  // Sort jobs: higher fill % and higher weight first (most urgent)
  const prioritised = [...jobs].sort((a, b) => {
    const scoreA = (a.fillPct || 0) * 0.6 + (a.estimatedKg || 0) * 0.4
    const scoreB = (b.fillPct || 0) * 0.6 + (b.estimatedKg || 0) * 0.4
    return scoreB - scoreA
  })

  const assignments = contractors.map(c => ({
    contractor: c,
    jobs:       [],
    route:      null,
    totalKm:    0,
    totalKg:    0,
    eta_start:  startTime instanceof Date ? startTime.toISOString() : startTime,
  }))

  // Greedy assignment — lowest-load eligible contractor first
  for (const job of prioritised) {
    const eligible = assignments
      .filter(a => {
        if (a.jobs.length >= (a.contractor.maxJobs || 10)) return false
        const cov = a.contractor.coverage
        if (!cov || !cov.length) return true
        return cov.some(area => (job.suburb || '').toLowerCase().includes(area.toLowerCase()))
      })
      .sort((a, b) => a.jobs.length - b.jobs.length)

    if (eligible.length) eligible[0].jobs.push(job)
  }

  // Optimise route and build timeline for each contractor
  for (const assignment of assignments) {
    if (!assignment.jobs.length) continue

    const { stops, totalKm } = optimizeRoute(depot, assignment.jobs)
    const timeline = buildTimeline(startTime, stops)

    assignment.route     = timeline
    assignment.totalKm   = totalKm
    assignment.totalKg   = Math.round(assignment.jobs.reduce((s, j) => s + (j.estimatedKg || 0), 0) * 10) / 10
    assignment.eta_end   = timeline[timeline.length - 1]?.eta ?? null
  }

  return assignments
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

export const SYDNEY_DEPOT = { lat: -33.8688, lng: 151.2093, name: 'Sydney CBD Depot' }

/** Priority score for a station based on fill level */
export function stationPriority(fillPct, estimatedKg = 0) {
  return Math.min(100, fillPct * 0.7 + estimatedKg * 0.3)
}

/** Calculate the total estimated weight for a set of stops */
export function totalEstimatedKg(stops) {
  return Math.round(stops.reduce((s, st) => s + (st.estimatedKg || st.weight_today_kg || 0), 0) * 10) / 10
}

/** Group stations into regions by suburb prefix for load balancing */
export function groupByRegion(stations) {
  const regions = {}
  for (const s of stations) {
    const key = (s.suburb || 'Unknown').split(' ')[0]
    if (!regions[key]) regions[key] = []
    regions[key].push(s)
  }
  return regions
}
