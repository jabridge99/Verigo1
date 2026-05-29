// Executive Command Center — aggregated platform intelligence data

export const PLATFORM_HEALTH = {
  overall: 'degraded', // 'healthy' | 'degraded' | 'incident'
  updated: '2026-05-28T08:41:00Z',
  services: [
    { name: 'Deposit API',       status: 'operational', latency_ms: 84  },
    { name: 'Pricing Engine',    status: 'operational', latency_ms: 210 },
    { name: 'Payout Processor',  status: 'degraded',    latency_ms: 1_840, note: 'High queue load — P95 elevated' },
    { name: 'Fraud Engine',      status: 'operational', latency_ms: 140 },
    { name: 'Settlement',        status: 'operational', latency_ms: 320 },
    { name: 'Marketplace',       status: 'operational', latency_ms: 96  },
    { name: 'Logistics API',     status: 'operational', latency_ms: 188 },
  ],
}

export const OPS_METRICS = {
  active_stations:     { current: 847,  total: 1_024, pct: 82.7, added_7d: 14  },
  pickup_queue:        { pending: 124,  overdue: 8,   avg_wait_hrs: 2.4, on_time_pct: 91.2 },
  route_efficiency:    { on_time_pct: 91.2, avg_deviation_km: 2.8, routes_active: 34, target_pct: 95 },
  contractor_util:     { active_pct: 78.4, total: 218, avg_jobs_day: 4.2, target_pct: 85 },
  deposits_today:      { count: 1_284, weight_kg: 8_420, flagged: 32 },
}

export const FINANCIAL_METRICS = {
  payout_liability: {
    total_aud:     142_840,
    consumer_aud:   84_200,
    operator_aud:   48_400,
    merchant_aud:   10_240,
    trend_7d_pct:   +4.8,
  },
  treasury: {
    balance_aud:    2_840_000,
    change_30d_aud: +184_200,
    runway_days:    580,
    reserved_pct:   22.4,
  },
  logistics_margin: {
    pct:          18.4,
    change_7d:    +0.8,
    gross_aud:    284_000,
    target_pct:   20.0,
  },
  operator_payable: {
    total_aud:    84_200,
    overdue_aud:  12_400,
    avg_days:     3.2,
    pending_count: 14,
  },
  revenue_30d_aud: 284_000,
  revenue_7d_aud:   68_400,
}

export const PRICING_METRICS = {
  realised_margin:   { pct: 24.8, change_7d: -0.4, target_pct: 25.0 },
  pricing_exposure:  { total_aud: 48_200, at_risk_aud: 8_400, hedged_pct: 82.6 },
  active_model:      { id: 'MDL-001', name: 'AI Default', shadow_delta_pct: +1.2 },
  commodities: [
    { name: 'Copper',    symbol: 'Cu', unit: 'AUD/kg', price: 14.80, change_pct: +2.4, sparkline: [13.2, 13.8, 14.1, 13.9, 14.4, 14.6, 14.8] },
    { name: 'Aluminium', symbol: 'Al', unit: 'AUD/kg', price: 4.20,  change_pct: -0.8, sparkline: [4.4,  4.3,  4.3,  4.2,  4.1,  4.2,  4.2 ] },
    { name: 'Steel',     symbol: 'Fe', unit: 'AUD/kg', price: 1.85,  change_pct: +0.5, sparkline: [1.80, 1.82, 1.81, 1.83, 1.84, 1.85, 1.85] },
    { name: 'Gold',      symbol: 'Au', unit: 'AUD/g',  price: 4_840, change_pct: +3.1, sparkline: [4_620, 4_680, 4_720, 4_760, 4_800, 4_820, 4_840] },
  ],
}

export const RISK_SUMMARY = {
  platform_risk_score: 42,
  fraud_alerts:    { critical: 1, high: 3, medium: 1, total_open: 5 },
  payout_holds:    { total_aud: 9_510, count: 4, oldest_days: 13 },
  contamination_hotspots: [
    { zone: 'Melbourne West',   zone_id: 'ECO-Z-0018', type: 'composition_mismatch', severity: 'high'   },
    { zone: 'Sydney North',     zone_id: 'ECO-Z-0041', type: 'abnormal_weight',      severity: 'medium' },
    { zone: 'Brisbane South',   zone_id: 'ECO-Z-0029', type: 'operator_collusion',   severity: 'high'   },
  ],
  auto_blocks_today: 12,
}

export const GROWTH_METRICS = {
  active_users:     { count: 24_841, wow_pct: +8.2,  mom_pct: +22.4, new_today: 184  },
  operator_partners:{ count: 182,    added_30d: 3,   pending: 8,     churned_30d: 0  },
  station_count:    { total: 1_024,  added_30d: 14,  in_deployment: 24, offline: 177  },
  marketplace:      { redemptions_30d: 2_847, points_redeemed_30d: 142_000, active_merchants: 8, gmv_aud: 14_235 },
  referrals_30d:    { count: 1_284, converted: 847, conversion_pct: 66 },
}

// 7/30/90 day forecasts
export const FORECASTS = {
  '7d': {
    label: '7-Day Outlook',
    confidence: 92,
    revenue_aud:    48_400,
    users:          26_200,
    stations:        1_038,
    deposits:        18_400,
    margin_pct:      25.1,
    fraud_rate_pct:   1.8,
    payout_aud:      51_200,
    new_operators:       2,
  },
  '30d': {
    label: '30-Day Outlook',
    confidence: 78,
    revenue_aud:   196_000,
    users:          31_400,
    stations:        1_084,
    deposits:        76_800,
    margin_pct:      25.4,
    fraud_rate_pct:   1.6,
    payout_aud:     208_000,
    new_operators:       9,
  },
  '90d': {
    label: '90-Day Outlook',
    confidence: 61,
    revenue_aud:   612_000,
    users:          42_800,
    stations:        1_180,
    deposits:       228_000,
    margin_pct:      26.1,
    fraud_rate_pct:   1.4,
    payout_aud:     640_000,
    new_operators:      28,
  },
}

// 30-day daily revenue sparkline (AUD thousands)
export const REVENUE_HISTORY_30D = [
  7.2, 8.1, 7.8, 9.4, 8.8, 10.2, 11.4, 9.6, 10.8, 11.2,
  10.4, 12.1, 11.8, 13.2, 12.4, 11.8, 13.6, 14.2, 12.8, 13.4,
  14.8, 15.2, 13.9, 14.6, 15.8, 14.4, 16.1, 15.6, 14.8, 16.8,
]

// 30-day daily deposit count sparkline
export const DEPOSITS_HISTORY_30D = [
  840, 920, 870, 1_040, 980, 1_120, 1_240, 1_060, 1_180, 1_220,
  1_140, 1_320, 1_280, 1_440, 1_360, 1_300, 1_480, 1_540, 1_400, 1_460,
  1_600, 1_640, 1_520, 1_580, 1_700, 1_560, 1_740, 1_700, 1_620, 1_820,
]

// 7-day daily alert volumes (for context in risk panel)
export const ALERTS_HISTORY_7D = [18, 24, 21, 31, 28, 14, 12]

export const EXEC_SUMMARY_ALERTS = [
  { id: 'XA-001', severity: 'critical', msg: 'Payout Processor P95 latency at 1.84s — SLA breach imminent', module: 'Platform', ts: '08:12' },
  { id: 'XA-002', severity: 'high',     msg: '1 account suspended (USR-40821) — $830 payout on hold', module: 'Fraud', ts: '06:44' },
  { id: 'XA-003', severity: 'high',     msg: 'Operator settlement hold — FastRecycle Co. $6,400 pending compliance', module: 'Settlement', ts: '2026-05-18' },
  { id: 'XA-004', severity: 'medium',   msg: 'Logistics margin 1.6pp below 20% target — route optimisation review needed', module: 'Finance', ts: '2026-05-27' },
  { id: 'XA-005', severity: 'low',      msg: '8 operator partner applications pending approval', module: 'Growth', ts: '2026-05-26' },
]
