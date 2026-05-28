// Platform Roadmap — financial model data and computation engine

// ─── Phase definitions ────────────────────────────────────────────────────────

export const PHASES = [
  {
    id: 1, name: 'MVP', label: 'Phase 1 — MVP',
    color: 'eco', duration_months: 12, start_month: 1,
    stations_end: 20,
    description: 'Web platform, manual operations, simulated pricing, basic payouts.',
    features: [
      'Web platform (consumer + operator portals)',
      'Manual weighbridge operations',
      'Simulated commodity pricing engine',
      'Basic payout processing (bank transfer)',
      '10–20 collection stations (metro)',
      'KYC & identity verification',
      'Core fraud detection (7 signals)',
      'Eco Rewards Marketplace (MVP)',
    ],
    status: 'current',
  },
  {
    id: 2, name: 'Pilot', label: 'Phase 2 — Pilot',
    color: 'amber', duration_months: 18, start_month: 13,
    stations_end: 100,
    description: 'Contractor logistics, live pricing, payout rails, operator onboarding.',
    features: [
      'Contractor logistics network (3PL integration)',
      'Live commodity pricing (real-time feeds)',
      'Bank-grade payout rails (NPP/Osko)',
      'Operator onboarding + partner portal',
      'Warehouse intake & WOMS system',
      '50–100 stations (2 major cities)',
      'Campaign management + Group Rewards',
      'Advanced fraud ML models',
    ],
    status: 'planned',
  },
  {
    id: 3, name: 'Scale', label: 'Phase 3 — Scale',
    color: 'violet', duration_months: 24, start_month: 31,
    stations_end: 500,
    description: 'IoT bins, AI pricing, route optimisation, national rollout.',
    features: [
      'IoT-enabled smart bins (sensor + camera)',
      'AI/ML pricing engine (GPT-4 + market data)',
      'Route optimisation (ML-powered logistics)',
      'Advanced fraud detection (graph neural net)',
      'National rollout — all capital cities',
      '100–500 stations across Australia',
      'Shadow pricing lab in production',
      'Carbon impact reporting (scoped)',
    ],
    status: 'planned',
  },
  {
    id: 4, name: 'Enterprise', label: 'Phase 4 — Enterprise',
    color: 'indigo', duration_months: 30, start_month: 55,
    stations_end: 1_200,
    description: 'Council contracts, industrial recovery, commodity desk, API ecosystem.',
    features: [
      'Council & government contracts (B2G)',
      'Industrial e-waste recovery (B2B)',
      'In-house commodity trading desk',
      'Public API ecosystem + developer portal',
      'Carbon credit tokenization layer',
      'Sustainability reporting (TCFD/ISSB)',
      'International expansion (NZ, SE Asia)',
      '1,000–1,200 stations nationally',
    ],
    status: 'planned',
  },
]

// ─── CAPEX by phase ───────────────────────────────────────────────────────────

export const CAPEX_ITEMS = {
  1: [
    { item: 'Platform development (web + mobile-ready)',  amount: 120_000, category: 'Software'  },
    { item: 'Station hardware — 15 units @ $2K ea',      amount:  30_000, category: 'Hardware'  },
    { item: 'Legal, regulatory & IP',                    amount:  20_000, category: 'Legal'     },
    { item: 'Office setup & equipment',                  amount:  10_000, category: 'Office'    },
  ],
  2: [
    { item: 'Warehouse fit-out (2 sites)',               amount: 150_000, category: 'Facilities' },
    { item: 'Logistics vehicles — 2 vans @ $60K ea',    amount: 120_000, category: 'Equipment'  },
    { item: 'IoT pilot hardware — 20 units @ $1.5K ea', amount:  30_000, category: 'Hardware'   },
    { item: 'Platform expansion (logistics + pricing)',  amount: 180_000, category: 'Software'   },
    { item: 'Working capital reserve',                   amount: 100_000, category: 'Capital'    },
  ],
  3: [
    { item: 'IoT smart bins — 400 units @ $2.5K ea',    amount: 1_000_000, category: 'Hardware'   },
    { item: 'AI/ML infrastructure & training',          amount:   300_000, category: 'Software'   },
    { item: 'National logistics hub network (4 sites)', amount:   500_000, category: 'Facilities' },
    { item: 'Data centre & edge compute',               amount:   200_000, category: 'Hardware'   },
  ],
  4: [
    { item: 'Commodity trading desk & systems',         amount:   400_000, category: 'Software'   },
    { item: 'Public API platform & developer portal',   amount:   600_000, category: 'Software'   },
    { item: 'Carbon credit tokenization layer',         amount:   800_000, category: 'Software'   },
    { item: 'Carbon reporting infrastructure',          amount:   250_000, category: 'Compliance' },
  ],
}

// ─── Monthly OPEX by phase ────────────────────────────────────────────────────

export const OPEX_MONTHLY = {
  1: [
    { item: 'Engineering team (3 engineers)',    amount: 36_000, category: 'People'  },
    { item: 'Operations (2 FTE)',                amount: 16_000, category: 'People'  },
    { item: 'Cloud infrastructure',              amount:  3_000, category: 'Tech'    },
    { item: 'Marketing & acquisition',           amount:  8_000, category: 'Growth'  },
    { item: 'Compliance & legal (retainer)',     amount:  3_500, category: 'Legal'   },
    { item: 'Miscellaneous',                     amount:  2_500, category: 'Other'   },
  ],
  2: [
    { item: 'Engineering team (6 engineers)',    amount:  72_000, category: 'People'    },
    { item: 'Operations & logistics (5 FTE)',    amount:  60_000, category: 'People'    },
    { item: 'Cloud infrastructure (scaled)',     amount:  15_000, category: 'Tech'      },
    { item: 'Marketing & growth',                amount:  18_000, category: 'Growth'    },
    { item: 'Warehouse operations',              amount:  20_000, category: 'Logistics' },
    { item: 'Compliance & legal',                amount:   8_000, category: 'Legal'     },
    { item: 'Miscellaneous',                     amount:   5_000, category: 'Other'     },
  ],
  3: [
    { item: 'Engineering team (18 engineers)',   amount: 216_000, category: 'People'    },
    { item: 'Operations & logistics (15 FTE)',   amount: 165_000, category: 'People'    },
    { item: 'Cloud / AI inference / data',       amount:  55_000, category: 'Tech'      },
    { item: 'Marketing & national campaigns',    amount:  40_000, category: 'Growth'    },
    { item: 'Logistics network (fuel + maint)',  amount:  50_000, category: 'Logistics' },
    { item: 'Compliance & regulatory',           amount:  15_000, category: 'Legal'     },
    { item: 'IoT maintenance & support',         amount:  20_000, category: 'Tech'      },
    { item: 'Miscellaneous',                     amount:  12_000, category: 'Other'     },
  ],
  4: [
    { item: 'Engineering & product (40 FTE)',    amount: 480_000, category: 'People'    },
    { item: 'Operations & logistics (20 FTE)',   amount: 240_000, category: 'People'    },
    { item: 'Cloud, AI & trading infrastructure',amount:  90_000, category: 'Tech'      },
    { item: 'Marketing & partnerships',          amount:  60_000, category: 'Growth'    },
    { item: 'National logistics network',        amount:  80_000, category: 'Logistics' },
    { item: 'Compliance, legal & carbon audit',  amount:  35_000, category: 'Legal'     },
    { item: 'IoT maintenance (1,200 units)',      amount:  48_000, category: 'Tech'      },
    { item: 'Miscellaneous',                     amount:  20_000, category: 'Other'     },
  ],
}

// ─── Revenue model assumptions by phase ──────────────────────────────────────

export const REVENUE_ASSUMPTIONS = {
  1: { deposits_per_station_day: 8,  avg_deposit_gross_aud: 8.00,  platform_margin_pct: 25, marketplace_monthly: 0,      api_monthly: 0,       carbon_monthly: 0      },
  2: { deposits_per_station_day: 15, avg_deposit_gross_aud: 9.50,  platform_margin_pct: 28, marketplace_monthly: 8_000,  api_monthly: 0,       carbon_monthly: 0      },
  3: { deposits_per_station_day: 22, avg_deposit_gross_aud: 11.00, platform_margin_pct: 32, marketplace_monthly: 45_000, api_monthly: 15_000,  carbon_monthly: 8_000  },
  4: { deposits_per_station_day: 28, avg_deposit_gross_aud: 14.00, platform_margin_pct: 35, marketplace_monthly: 180_000,api_monthly: 120_000, carbon_monthly: 60_000 },
}

// Station ramp schedule: month → cumulative station count
function buildStationSchedule() {
  const schedule = new Array(85).fill(0)
  // Phase 1: 0→20 stations over months 1-12
  for (let m = 1; m <= 12; m++) schedule[m] = Math.round((m / 12) * 20)
  // Phase 2: 20→100 stations over months 13-30
  for (let m = 13; m <= 30; m++) schedule[m] = 20 + Math.round(((m - 12) / 18) * 80)
  // Phase 3: 100→500 stations over months 31-54
  for (let m = 31; m <= 54; m++) schedule[m] = 100 + Math.round(((m - 30) / 24) * 400)
  // Phase 4: 500→1200 stations over months 55-84
  for (let m = 55; m <= 84; m++) schedule[m] = 500 + Math.round(((m - 54) / 30) * 700)
  return schedule
}

export const BASE_STATION_SCHEDULE = buildStationSchedule()

function getPhaseForMonth(m) {
  if (m <= 12)  return 1
  if (m <= 30)  return 2
  if (m <= 54)  return 3
  return 4
}

// CAPEX disbursement: which months does each phase's CAPEX get spent?
const CAPEX_DISBURSEMENT = {
  1: [1, 1, 2],    // spread over first 2 months of phase
  2: [13, 14, 14, 15, 13],
  3: [31, 31, 32, 32],
  4: [55, 55, 56, 55],
}

// ─── Core computation engine ──────────────────────────────────────────────────

export const DEFAULT_PARAMS = {
  platform_margin_pct:        28,
  deposits_per_station_day:   15,
  avg_deposit_gross_aud:       9.50,
  station_rollout_multiplier:  1.0,
  capex_multiplier:            1.0,
  opex_multiplier:             1.0,
  discount_rate_annual_pct:   10,
  marketplace_multiplier:      1.0,
}

export function computeModel(params = DEFAULT_PARAMS) {
  const {
    platform_margin_pct,
    deposits_per_station_day,
    avg_deposit_gross_aud,
    station_rollout_multiplier,
    capex_multiplier,
    opex_multiplier,
    discount_rate_annual_pct,
    marketplace_multiplier,
  } = params

  const monthlyDiscountRate = Math.pow(1 + discount_rate_annual_pct / 100, 1 / 12) - 1

  // Pre-compute CAPEX map: month → total capex spend
  const capexByMonth = {}
  for (const [phase, months] of Object.entries(CAPEX_DISBURSEMENT)) {
    const items = CAPEX_ITEMS[phase] ?? []
    const totalCapex = items.reduce((s, i) => s + i.amount, 0) * capex_multiplier
    const perMonth = {}
    months.forEach(m => { perMonth[m] = (perMonth[m] ?? 0) + totalCapex / months.length })
    Object.entries(perMonth).forEach(([m, v]) => { capexByMonth[m] = (capexByMonth[m] ?? 0) + v })
  }

  // Build monthly model (84 months)
  const monthly = []
  let cumCashFlow = 0
  let beMonth = null

  for (let m = 1; m <= 84; m++) {
    const phase = getPhaseForMonth(m)
    const ra = REVENUE_ASSUMPTIONS[phase]

    // Station count with rollout multiplier
    const baseStations = BASE_STATION_SCHEDULE[m] ?? BASE_STATION_SCHEDULE[84]
    const stations = Math.round(baseStations * station_rollout_multiplier)

    // Override revenue assumptions with adjustable params
    const marginPct = platform_margin_pct / 100
    const depsPerDay = deposits_per_station_day * (phase === 1 ? 0.53 : phase === 2 ? 1.0 : phase === 3 ? 1.47 : 1.87)
    const grossPerDep = avg_deposit_gross_aud * (phase === 1 ? 0.84 : phase === 2 ? 1.0 : phase === 3 ? 1.16 : 1.47)
    const depositRevenue = stations * depsPerDay * grossPerDep * marginPct * 30
    const marketplaceRevenue = ra.marketplace_monthly * marketplace_multiplier
    const apiRevenue = ra.api_monthly
    const carbonRevenue = ra.carbon_monthly
    const totalRevenue = depositRevenue + marketplaceRevenue + apiRevenue + carbonRevenue

    // OPEX
    const baseOpex = OPEX_MONTHLY[phase].reduce((s, i) => s + i.amount, 0)
    const totalOpex = baseOpex * opex_multiplier

    // CAPEX (lump in disbursement months)
    const totalCapex = capexByMonth[m] ?? 0

    const cashFlow = totalRevenue - totalOpex - totalCapex
    cumCashFlow += cashFlow
    if (beMonth === null && cumCashFlow >= 0) beMonth = m

    // Present value
    const pv = cashFlow / Math.pow(1 + monthlyDiscountRate, m)

    monthly.push({
      month: m, phase,
      stations,
      revenue: Math.round(totalRevenue),
      deposit_revenue: Math.round(depositRevenue),
      marketplace_revenue: Math.round(marketplaceRevenue),
      api_revenue: Math.round(apiRevenue),
      opex: Math.round(totalOpex),
      capex: Math.round(totalCapex),
      cash_flow: Math.round(cashFlow),
      cum_cash_flow: Math.round(cumCashFlow),
      pv: Math.round(pv),
    })
  }

  return { monthly, breakeven_month: beMonth }
}

export function computeNPV(monthly) {
  return monthly.reduce((s, m) => s + m.pv, 0)
}

export function computePeakFunding(monthly) {
  return Math.abs(Math.min(...monthly.map(m => m.cum_cash_flow), 0))
}

export function computeIRR(monthly) {
  // Binary search for monthly rate where NPV = 0
  let lo = -0.05, hi = 0.20
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const npv = monthly.reduce((s, m, idx) => s + m.cash_flow / Math.pow(1 + mid, idx + 1), 0)
    if (npv > 0) lo = mid; else hi = mid
  }
  const monthlyRate = (lo + hi) / 2
  return parseFloat(((Math.pow(1 + monthlyRate, 12) - 1) * 100).toFixed(1))
}

export function computePhaseSummary(monthly) {
  const phases = {}
  for (const m of monthly) {
    if (!phases[m.phase]) phases[m.phase] = { revenue: 0, opex: 0, capex: 0, cashFlow: 0, months: 0 }
    const p = phases[m.phase]
    p.revenue   += m.revenue
    p.opex      += m.opex
    p.capex     += m.capex
    p.cashFlow  += m.cash_flow
    p.months++
  }
  return phases
}

export function stationsAtMonth(monthly, month) {
  return monthly.find(m => m.month === month)?.stations ?? 0
}

// ─── Milestone markers for chart annotations ─────────────────────────────────

export const MILESTONES = [
  { month: 4,  label: 'First station live',        phase: 1 },
  { month: 12, label: 'Phase 1 complete',           phase: 1 },
  { month: 18, label: '50 stations',                phase: 2 },
  { month: 24, label: 'Live pricing deployed',      phase: 2 },
  { month: 30, label: 'Phase 2 complete',           phase: 2 },
  { month: 36, label: '200 stations',               phase: 3 },
  { month: 48, label: 'AI pricing live',            phase: 3 },
  { month: 54, label: 'Phase 3 complete',           phase: 3 },
  { month: 60, label: '800 stations',               phase: 4 },
  { month: 72, label: 'Carbon desk launch',         phase: 4 },
  { month: 84, label: '1,200 stations',             phase: 4 },
]

// ─── TAM / market context ─────────────────────────────────────────────────────

export const MARKET_CONTEXT = {
  aus_ewaste_tonnes_yr: 539_000,
  global_ewaste_usd_bn: 62,
  aus_recycling_rate_pct: 10,
  avg_ewaste_value_per_tonne_aud: 2_800,
  ecobin_tam_aud: 540_000 * 2_800 * 0.10,   // ~$151M addressable
  serviceable_yr5_pct: 8,
}
