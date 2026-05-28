// Shadow Mode Pricing Lab — data layer
// Shadow prices are NEVER shown to consumers. All comparison is internal only.

// ─── Pricing Models ──────────────────────────────────────────────────────────

export const SHADOW_MODELS = [
  {
    id: 'MDL-001',
    name: 'AI Default',
    tag: 'production',
    short: 'Baseline AI model currently serving all consumer quotes',
    target_margin_pct: 28.4,
    blend: { commodity: 0.55, competitor: 0.20, sentiment: 0.10, scrap: 0.15 },
    status: 'production',
    color: 'eco',
    created: '2026-02-14',
    promoted_from: null,
  },
  {
    id: 'MDL-002',
    name: 'Margin Max',
    tag: 'shadow',
    short: 'Maximise margin — tighter offers, sacrifice volume for profitability',
    target_margin_pct: 38.0,
    blend: { commodity: 0.60, competitor: 0.10, sentiment: 0.05, scrap: 0.25 },
    status: 'shadow_active',
    color: 'violet',
    created: '2026-04-01',
    promoted_from: null,
  },
  {
    id: 'MDL-003',
    name: 'Volume Max',
    tag: 'shadow',
    short: 'Maximise collection volume — lower margin, higher throughput, more data',
    target_margin_pct: 21.0,
    blend: { commodity: 0.45, competitor: 0.30, sentiment: 0.15, scrap: 0.10 },
    status: 'shadow_active',
    color: 'amber',
    created: '2026-04-01',
    promoted_from: null,
  },
  {
    id: 'MDL-004',
    name: 'Fraud Weighted',
    tag: 'shadow',
    short: 'Risk-adjusted pricing — lower offers to high-risk segments to reduce fraud exposure',
    target_margin_pct: 30.1,
    blend: { commodity: 0.50, competitor: 0.18, sentiment: 0.08, scrap: 0.24 },
    status: 'shadow_paused',
    color: 'red',
    created: '2026-03-10',
    promoted_from: null,
  },
  {
    id: 'MDL-005',
    name: 'Operator Growth',
    tag: 'shadow',
    short: 'Tiered pricing — incentivise new operator activation and network expansion',
    target_margin_pct: 25.5,
    blend: { commodity: 0.48, competitor: 0.25, sentiment: 0.12, scrap: 0.15 },
    status: 'shadow_active',
    color: 'indigo',
    created: '2026-04-15',
    promoted_from: null,
  },
]

// ─── Performance Metrics per model × period ──────────────────────────────────
// volume_units: weekly e-waste units collected
// margin_pct: realised average margin
// fraud_rate_pct: % of quotes flagged by anti-fraud engine
// operator_growth_pct: month-on-month operator network growth
// logistics_load: avg pickups per truck per day
// revenue_aud: gross revenue AUD for the period
// ci_margin: 95% confidence interval half-width on margin_pct

export const PERFORMANCE_METRICS = {
  'MDL-001': {
    '7d':  { volume_units: 1842, margin_pct: 28.4, fraud_rate_pct: 1.12, operator_growth_pct: 2.1,  logistics_load: 14.2, revenue_aud: 312_440, ci_margin: 0.6 },
    '30d': { volume_units: 7_918, margin_pct: 28.1, fraud_rate_pct: 1.09, operator_growth_pct: 2.3,  logistics_load: 14.0, revenue_aud: 1_341_600, ci_margin: 0.4 },
    '90d': { volume_units: 23_754, margin_pct: 27.8, fraud_rate_pct: 1.14, operator_growth_pct: 2.0,  logistics_load: 13.8, revenue_aud: 3_992_700, ci_margin: 0.3 },
    '180d':{ volume_units: 47_508, margin_pct: 28.0, fraud_rate_pct: 1.11, operator_growth_pct: 2.2,  logistics_load: 14.1, revenue_aud: 7_985_400, ci_margin: 0.2 },
  },
  'MDL-002': {
    '7d':  { volume_units: 1_510, margin_pct: 37.6, fraud_rate_pct: 0.98, operator_growth_pct: 1.6,  logistics_load: 11.6, revenue_aud: 327_890, ci_margin: 0.9 },
    '30d': { volume_units: 6_490, margin_pct: 37.2, fraud_rate_pct: 0.96, operator_growth_pct: 1.7,  logistics_load: 11.4, revenue_aud: 1_406_200, ci_margin: 0.6 },
    '90d': { volume_units: 19_470, margin_pct: 36.9, fraud_rate_pct: 0.99, operator_growth_pct: 1.5,  logistics_load: 11.2, revenue_aud: 4_195_900, ci_margin: 0.4 },
    '180d':{ volume_units: 38_940, margin_pct: 37.1, fraud_rate_pct: 0.97, operator_growth_pct: 1.6,  logistics_load: 11.5, revenue_aud: 8_391_800, ci_margin: 0.3 },
  },
  'MDL-003': {
    '7d':  { volume_units: 2_414, margin_pct: 21.3, fraud_rate_pct: 1.41, operator_growth_pct: 2.8,  logistics_load: 18.5, revenue_aud: 298_110, ci_margin: 0.8 },
    '30d': { volume_units: 10_376, margin_pct: 21.0, fraud_rate_pct: 1.38, operator_growth_pct: 2.9,  logistics_load: 18.2, revenue_aud: 1_281_700, ci_margin: 0.5 },
    '90d': { volume_units: 31_128, margin_pct: 20.8, fraud_rate_pct: 1.44, operator_growth_pct: 2.7,  logistics_load: 18.0, revenue_aud: 3_841_500, ci_margin: 0.4 },
    '180d':{ volume_units: 62_256, margin_pct: 21.1, fraud_rate_pct: 1.40, operator_growth_pct: 2.8,  logistics_load: 18.3, revenue_aud: 7_683_000, ci_margin: 0.3 },
  },
  'MDL-004': {
    '7d':  { volume_units: 1_736, margin_pct: 30.0, fraud_rate_pct: 0.61, operator_growth_pct: 2.0,  logistics_load: 13.3, revenue_aud: 307_200, ci_margin: 1.1 },
    '30d': { volume_units: 7_460, margin_pct: 29.8, fraud_rate_pct: 0.59, operator_growth_pct: 2.1,  logistics_load: 13.1, revenue_aud: 1_319_600, ci_margin: 0.8 },
    '90d': { volume_units: 22_380, margin_pct: 29.6, fraud_rate_pct: 0.63, operator_growth_pct: 1.9,  logistics_load: 12.9, revenue_aud: 3_931_200, ci_margin: 0.6 },
    '180d':{ volume_units: 44_760, margin_pct: 29.7, fraud_rate_pct: 0.61, operator_growth_pct: 2.0,  logistics_load: 13.0, revenue_aud: 7_862_400, ci_margin: 0.4 },
  },
  'MDL-005': {
    '7d':  { volume_units: 2_009, margin_pct: 25.6, fraud_rate_pct: 1.08, operator_growth_pct: 3.8,  logistics_load: 15.4, revenue_aud: 301_350, ci_margin: 0.9 },
    '30d': { volume_units: 8_640, margin_pct: 25.3, fraud_rate_pct: 1.06, operator_growth_pct: 3.9,  logistics_load: 15.1, revenue_aud: 1_296_000, ci_margin: 0.6 },
    '90d': { volume_units: 25_920, margin_pct: 25.1, fraud_rate_pct: 1.10, operator_growth_pct: 3.7,  logistics_load: 14.9, revenue_aud: 3_873_600, ci_margin: 0.4 },
    '180d':{ volume_units: 51_840, margin_pct: 25.4, fraud_rate_pct: 1.07, operator_growth_pct: 3.8,  logistics_load: 15.2, revenue_aud: 7_747_200, ci_margin: 0.3 },
  },
}

// ─── A/B Tests ────────────────────────────────────────────────────────────────

export const AB_TESTS = [
  {
    id: 'ABT-0014',
    name: 'Margin Max vs Baseline — Smartphone Segment',
    control_model: 'MDL-001',
    variant_model: 'MDL-002',
    status: 'active',
    allocation_pct: 15,
    device_scope: ['smartphone'],
    region_scope: ['NSW', 'VIC'],
    started: '2026-05-01',
    ends: '2026-06-01',
    significance: 0.87,
    significance_target: 0.95,
    control_metrics: { volume_units: 612, margin_pct: 28.2, fraud_rate_pct: 1.10, revenue_aud: 98_400 },
    variant_metrics: { volume_units: 491, margin_pct: 37.4, fraud_rate_pct: 0.94, revenue_aud: 105_760 },
    decision: null,
    notes: 'Variant margin gain is real but volume loss is significant. Awaiting 95% significance.',
  },
  {
    id: 'ABT-0013',
    name: 'Volume Max vs Baseline — All Devices, QLD Pilot',
    control_model: 'MDL-001',
    variant_model: 'MDL-003',
    status: 'active',
    allocation_pct: 20,
    device_scope: ['smartphone', 'laptop', 'tablet', 'mixed_ewaste'],
    region_scope: ['QLD'],
    started: '2026-04-20',
    ends: '2026-05-31',
    significance: 0.79,
    significance_target: 0.95,
    control_metrics: { volume_units: 487, margin_pct: 28.0, fraud_rate_pct: 1.09, revenue_aud: 74_200 },
    variant_metrics: { volume_units: 641, margin_pct: 21.1, fraud_rate_pct: 1.39, revenue_aud: 72_800 },
    decision: null,
    notes: '+31.6% volume but margin erosion and elevated fraud. Monitoring fraud closely.',
  },
  {
    id: 'ABT-0012',
    name: 'Operator Growth vs Baseline — Tier 2 Cities',
    control_model: 'MDL-001',
    variant_model: 'MDL-005',
    status: 'completed',
    allocation_pct: 30,
    device_scope: ['smartphone', 'laptop', 'desktop', 'tablet', 'tv_monitor', 'large_appliance', 'mixed_ewaste'],
    region_scope: ['SA', 'WA', 'TAS'],
    started: '2026-03-01',
    ends: '2026-04-30',
    significance: 0.97,
    significance_target: 0.95,
    control_metrics: { volume_units: 1_204, margin_pct: 27.9, fraud_rate_pct: 1.11, revenue_aud: 188_400 },
    variant_metrics: { volume_units: 1_314, margin_pct: 25.5, fraud_rate_pct: 1.06, revenue_aud: 192_200 },
    decision: 'promote',
    notes: 'Statistically significant operator network growth. Promoting MDL-005 to 10% gradual rollout nationally.',
  },
  {
    id: 'ABT-0011',
    name: 'Fraud Weighted vs Baseline — High-Risk Postcodes',
    control_model: 'MDL-001',
    variant_model: 'MDL-004',
    status: 'completed',
    allocation_pct: 10,
    device_scope: ['smartphone', 'laptop'],
    region_scope: ['NSW'],
    started: '2026-02-15',
    ends: '2026-03-15',
    significance: 0.96,
    significance_target: 0.95,
    control_metrics: { volume_units: 340, margin_pct: 28.3, fraud_rate_pct: 2.81, revenue_aud: 54_100 },
    variant_metrics: { volume_units: 312, margin_pct: 30.2, fraud_rate_pct: 0.62, revenue_aud: 54_800 },
    decision: 'archive',
    notes: 'Fraud halved. But volume decline in high-risk postcodes raises equity concern — archived pending policy review.',
  },
]

// ─── Price Elasticity Data ────────────────────────────────────────────────────
// coefficient: price elasticity of demand (negative = elastic)
// curve: [{price_multiplier, volume_multiplier}] — 9 points for chart
// cross_elasticity: how much volume changes when ANOTHER device price changes

export const ELASTICITY_DATA = {
  smartphone: {
    coefficient: -1.42,
    label: 'Elastic — consumers shop around extensively',
    curve: [
      { price_mult: 0.70, volume_mult: 1.68 }, { price_mult: 0.80, volume_mult: 1.38 },
      { price_mult: 0.90, volume_mult: 1.16 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.86 }, { price_mult: 1.20, volume_mult: 0.73 },
      { price_mult: 1.30, volume_mult: 0.61 }, { price_mult: 1.40, volume_mult: 0.50 },
      { price_mult: 1.50, volume_mult: 0.40 },
    ],
    reference_offer_aud: 82.50,
    reference_volume_wk: 540,
  },
  laptop: {
    coefficient: -1.08,
    label: 'Moderately elastic — price matters but convenience valued',
    curve: [
      { price_mult: 0.70, volume_mult: 1.52 }, { price_mult: 0.80, volume_mult: 1.28 },
      { price_mult: 0.90, volume_mult: 1.11 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.89 }, { price_mult: 1.20, volume_mult: 0.79 },
      { price_mult: 1.30, volume_mult: 0.69 }, { price_mult: 1.40, volume_mult: 0.60 },
      { price_mult: 1.50, volume_mult: 0.51 },
    ],
    reference_offer_aud: 148.00,
    reference_volume_wk: 310,
  },
  desktop: {
    coefficient: -0.71,
    label: 'Inelastic — few alternatives, logistics-driven decision',
    curve: [
      { price_mult: 0.70, volume_mult: 1.22 }, { price_mult: 0.80, volume_mult: 1.13 },
      { price_mult: 0.90, volume_mult: 1.06 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.93 }, { price_mult: 1.20, volume_mult: 0.86 },
      { price_mult: 1.30, volume_mult: 0.79 }, { price_mult: 1.40, volume_mult: 0.72 },
      { price_mult: 1.50, volume_mult: 0.65 },
    ],
    reference_offer_aud: 62.00,
    reference_volume_wk: 198,
  },
  tablet: {
    coefficient: -1.21,
    label: 'Elastic — often compared with smartphone channel',
    curve: [
      { price_mult: 0.70, volume_mult: 1.58 }, { price_mult: 0.80, volume_mult: 1.31 },
      { price_mult: 0.90, volume_mult: 1.12 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.88 }, { price_mult: 1.20, volume_mult: 0.76 },
      { price_mult: 1.30, volume_mult: 0.65 }, { price_mult: 1.40, volume_mult: 0.54 },
      { price_mult: 1.50, volume_mult: 0.44 },
    ],
    reference_offer_aud: 71.00,
    reference_volume_wk: 224,
  },
  tv_monitor: {
    coefficient: -0.58,
    label: 'Very inelastic — disposal-driven, price secondary',
    curve: [
      { price_mult: 0.70, volume_mult: 1.18 }, { price_mult: 0.80, volume_mult: 1.11 },
      { price_mult: 0.90, volume_mult: 1.05 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.95 }, { price_mult: 1.20, volume_mult: 0.89 },
      { price_mult: 1.30, volume_mult: 0.83 }, { price_mult: 1.40, volume_mult: 0.77 },
      { price_mult: 1.50, volume_mult: 0.71 },
    ],
    reference_offer_aud: 28.00,
    reference_volume_wk: 142,
  },
  large_appliance: {
    coefficient: -0.44,
    label: 'Near-inelastic — pickup logistics dominant factor',
    curve: [
      { price_mult: 0.70, volume_mult: 1.14 }, { price_mult: 0.80, volume_mult: 1.09 },
      { price_mult: 0.90, volume_mult: 1.04 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.96 }, { price_mult: 1.20, volume_mult: 0.91 },
      { price_mult: 1.30, volume_mult: 0.86 }, { price_mult: 1.40, volume_mult: 0.81 },
      { price_mult: 1.50, volume_mult: 0.76 },
    ],
    reference_offer_aud: 18.50,
    reference_volume_wk: 88,
  },
  mixed_ewaste: {
    coefficient: -0.93,
    label: 'Moderately elastic — bulk senders price-sensitive',
    curve: [
      { price_mult: 0.70, volume_mult: 1.42 }, { price_mult: 0.80, volume_mult: 1.24 },
      { price_mult: 0.90, volume_mult: 1.10 }, { price_mult: 1.00, volume_mult: 1.00 },
      { price_mult: 1.10, volume_mult: 0.91 }, { price_mult: 1.20, volume_mult: 0.82 },
      { price_mult: 1.30, volume_mult: 0.73 }, { price_mult: 1.40, volume_mult: 0.64 },
      { price_mult: 1.50, volume_mult: 0.55 },
    ],
    reference_offer_aud: 34.00,
    reference_volume_wk: 340,
  },
}

// ─── Virtual Market Twin ──────────────────────────────────────────────────────

export const MARKET_TWIN_PARAMS = {
  market_size_units_monthly: 32_000,
  ecobin_market_share_pct: 24.7,
  competitor_avg_offer_index: 1.00,
  copper_price_index: 1.00,
  aud_usd_index: 1.00,
  consumer_sentiment_index: 0.62,
  logistics_capacity_pct: 78,
  fraud_pressure_index: 1.00,
  operator_saturation_pct: 41,
}

export const TWIN_SCENARIOS = [
  {
    id: 'SCN-0018',
    name: 'Copper Shock +20%',
    description: 'Copper spikes 20% — LME driven by supply disruption',
    param_deltas: { copper_price_index: 1.20, consumer_sentiment_index: 0.71 },
    model_outcomes: {
      'MDL-001': { revenue_delta_pct: +8.4, margin_delta_pct: +3.1, volume_delta_pct: +2.2, fraud_delta_pct: -0.1 },
      'MDL-002': { revenue_delta_pct: +9.8, margin_delta_pct: +2.8, volume_delta_pct: -1.4, fraud_delta_pct: -0.2 },
      'MDL-003': { revenue_delta_pct: +7.1, margin_delta_pct: +3.4, volume_delta_pct: +5.9, fraud_delta_pct: +0.4 },
      'MDL-005': { revenue_delta_pct: +8.0, margin_delta_pct: +2.9, volume_delta_pct: +3.1, fraud_delta_pct: +0.1 },
    },
    run_date: '2026-05-20',
  },
  {
    id: 'SCN-0017',
    name: 'AUD Weakens to 0.58',
    description: 'Australian dollar drops — boosts commodity value in AUD terms',
    param_deltas: { aud_usd_index: 0.91, copper_price_index: 1.08 },
    model_outcomes: {
      'MDL-001': { revenue_delta_pct: +5.2, margin_delta_pct: +2.0, volume_delta_pct: +1.1, fraud_delta_pct: 0.0 },
      'MDL-002': { revenue_delta_pct: +6.4, margin_delta_pct: +1.8, volume_delta_pct: -0.9, fraud_delta_pct: -0.1 },
      'MDL-003': { revenue_delta_pct: +4.3, margin_delta_pct: +2.1, volume_delta_pct: +3.8, fraud_delta_pct: +0.3 },
      'MDL-005': { revenue_delta_pct: +5.0, margin_delta_pct: +1.9, volume_delta_pct: +1.8, fraud_delta_pct: +0.1 },
    },
    run_date: '2026-05-18',
  },
  {
    id: 'SCN-0016',
    name: 'Competitor Undercuts 15%',
    description: 'ReCell AU drops offers 15% — aggressive market grab',
    param_deltas: { competitor_avg_offer_index: 0.85, consumer_sentiment_index: 0.54 },
    model_outcomes: {
      'MDL-001': { revenue_delta_pct: -6.8, margin_delta_pct: -1.4, volume_delta_pct: -9.2, fraud_delta_pct: +0.2 },
      'MDL-002': { revenue_delta_pct: -8.1, margin_delta_pct: -0.8, volume_delta_pct: -14.7, fraud_delta_pct: +0.1 },
      'MDL-003': { revenue_delta_pct: -4.2, margin_delta_pct: -2.1, volume_delta_pct: -4.4, fraud_delta_pct: +0.5 },
      'MDL-005': { revenue_delta_pct: -5.9, margin_delta_pct: -1.6, volume_delta_pct: -7.1, fraud_delta_pct: +0.2 },
    },
    run_date: '2026-05-15',
  },
  {
    id: 'SCN-0015',
    name: 'Fraud Wave — Organised Ring',
    description: 'Organised fraud ring detected — high volume of low-grade devices as high-value',
    param_deltas: { fraud_pressure_index: 2.40, consumer_sentiment_index: 0.58 },
    model_outcomes: {
      'MDL-001': { revenue_delta_pct: -2.1, margin_delta_pct: -4.8, volume_delta_pct: +3.4, fraud_delta_pct: +3.1 },
      'MDL-002': { revenue_delta_pct: -1.4, margin_delta_pct: -4.1, volume_delta_pct: +1.2, fraud_delta_pct: +2.4 },
      'MDL-003': { revenue_delta_pct: -3.8, margin_delta_pct: -6.4, volume_delta_pct: +7.8, fraud_delta_pct: +4.9 },
      'MDL-005': { revenue_delta_pct: -2.0, margin_delta_pct: -4.6, volume_delta_pct: +3.1, fraud_delta_pct: +2.9 },
    },
    run_date: '2026-05-10',
  },
  {
    id: 'SCN-0014',
    name: 'Logistics Crunch — Capacity -30%',
    description: 'Driver shortage reduces pickup capacity by 30%',
    param_deltas: { logistics_capacity_pct: 0.70 },
    model_outcomes: {
      'MDL-001': { revenue_delta_pct: -14.2, margin_delta_pct: +1.8, volume_delta_pct: -18.4, fraud_delta_pct: -0.3 },
      'MDL-002': { revenue_delta_pct: -10.1, margin_delta_pct: +2.6, volume_delta_pct: -14.8, fraud_delta_pct: -0.4 },
      'MDL-003': { revenue_delta_pct: -19.8, margin_delta_pct: +0.9, volume_delta_pct: -25.4, fraud_delta_pct: -0.5 },
      'MDL-005': { revenue_delta_pct: -13.4, margin_delta_pct: +2.0, volume_delta_pct: -17.1, fraud_delta_pct: -0.3 },
    },
    run_date: '2026-05-05',
  },
]

// ─── Gradual Rollout ──────────────────────────────────────────────────────────

export const ROLLOUT_STAGES = [
  { stage: 1, label: 'Canary',    allocation_pct: 0.5,  min_hours: 24  },
  { stage: 2, label: '1%',        allocation_pct: 1,    min_hours: 48  },
  { stage: 3, label: '5%',        allocation_pct: 5,    min_hours: 72  },
  { stage: 4, label: '10%',       allocation_pct: 10,   min_hours: 96  },
  { stage: 5, label: '25%',       allocation_pct: 25,   min_hours: 120 },
  { stage: 6, label: '50%',       allocation_pct: 50,   min_hours: 168 },
  { stage: 7, label: '75%',       allocation_pct: 75,   min_hours: 168 },
  { stage: 8, label: 'Full',      allocation_pct: 100,  min_hours: 0   },
]

export const ROLLOUT_HEALTH_GATES = {
  margin_floor_pct: 20.0,
  fraud_ceiling_pct: 2.50,
  volume_floor_units_wk: 1_400,
  logistics_ceiling_load: 22.0,
}

export const ACTIVE_ROLLOUT = {
  id: 'ROL-0009',
  model_id: 'MDL-005',
  model_name: 'Operator Growth',
  current_stage: 3,
  status: 'advancing',
  started: '2026-05-15',
  current_allocation_pct: 5,
  current_metrics: { margin_pct: 25.6, fraud_rate_pct: 1.08, volume_units: 1_890, logistics_load: 15.4 },
  gate_status: { margin: 'pass', fraud: 'pass', volume: 'pass', logistics: 'pass' },
  auto_advance: true,
  next_stage_eligible_at: '2026-05-29T08:00:00',
  notes: 'Performing well in Tier 2 cities. Auto-advance enabled.',
}

export const ROLLOUT_HISTORY = [
  {
    id: 'ROL-0008',
    model_id: 'MDL-003',
    model_name: 'Volume Max',
    final_stage: 2,
    outcome: 'rolled_back',
    reason: 'Fraud ceiling breached at 1% allocation — fraud_rate_pct exceeded 2.50 threshold',
    started: '2026-04-01',
    ended: '2026-04-03',
    peak_allocation_pct: 1,
  },
  {
    id: 'ROL-0007',
    model_id: 'MDL-002',
    model_name: 'Margin Max',
    final_stage: 5,
    outcome: 'paused',
    reason: 'Volume dropped 18.8% below floor at 25% allocation — Board review requested',
    started: '2026-03-10',
    ended: '2026-03-28',
    peak_allocation_pct: 25,
  },
  {
    id: 'ROL-0006',
    model_id: 'MDL-004',
    model_name: 'Fraud Weighted',
    final_stage: 8,
    outcome: 'archived',
    reason: 'Replaced by Operator Growth model post-policy review',
    started: '2026-01-20',
    ended: '2026-03-01',
    peak_allocation_pct: 100,
  },
]

// ─── Lab-wide summary stats ───────────────────────────────────────────────────

export const LAB_SUMMARY = {
  active_shadow_models: 3,
  active_ab_tests: 2,
  completed_ab_tests: 2,
  scenarios_run: 5,
  active_rollout: true,
  rollout_model: 'MDL-005',
  rollout_stage: 3,
  rollout_pct: 5,
  days_since_last_rollback: 56,
  best_shadow_revenue_delta_pct: +5.1,   // MDL-002 30d vs MDL-001 30d
  best_shadow_margin_delta_pct: +9.1,    // MDL-002 30d
  worst_shadow_fraud_delta_pct: +0.29,   // MDL-003 30d
}
