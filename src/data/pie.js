// ── Pricing Intelligence Engine (PIE) — Mock Data ────────────────────────────
// IMPORTANT: PRICING_ENGINE_CONFIG contains internal margin logic.
// Import PRICING_ENGINE_CONFIG only in admin-facing pages. NEVER expose to consumers or operators.

// ── Constants ─────────────────────────────────────────────────────────────────
const AUD_PER_USD = 1 / 0.6385   // 1.5662
const TROY_OZ_G   = 31.1035

// Helpers (used for precomputed aud_per_g values below)
function baseToAUDg(usdPerTonne) { return (usdPerTonne / 1e6) * AUD_PER_USD }
function preciousToAUDg(usdPerOzt)  { return (usdPerOzt / TROY_OZ_G) * AUD_PER_USD }

// ── FX Rates ──────────────────────────────────────────────────────────────────
export const FX_RATES = {
  AUD_USD:     { rate: 0.6385, change_24h: +0.0012, source: 'RBA / Bloomberg' },
  USD_AUD:     { rate: 1.5662, change_24h: -0.0029, source: 'RBA / Bloomberg' },
  AUD_EUR:     { rate: 0.5910, change_24h: -0.0008, source: 'ECB' },
  USD_CNY:     { rate: 7.2480, change_24h: +0.0040, source: 'PBOC' },
  AUD_GBP:     { rate: 0.5044, change_24h: +0.0006, source: 'Bloomberg' },
  last_updated: '2026-05-28T10:15:00Z',
}

// ── Commodities ───────────────────────────────────────────────────────────────
// LME: copper, aluminium, tin, nickel (USD/tonne)
// CME: gold, silver, palladium (USD/troy oz)
export const COMMODITIES = {
  copper: {
    symbol: 'CU', name: 'Copper', exchange: 'LME', unit: 'USD/t',
    spot_usd: 9842.50, forward_3m_usd: 9780.00,
    change_24h_pct: +1.82, change_7d_pct: +3.14,
    w52_high: 10480, w52_low: 7920,
    trend: 'up',
    aud_per_g: baseToAUDg(9842.50),     // 0.01542
    aud_per_kg: baseToAUDg(9842.50) * 1000,
    dominance: 'Bulk recovery',
  },
  aluminium: {
    symbol: 'AL', name: 'Aluminium', exchange: 'LME', unit: 'USD/t',
    spot_usd: 2418.00, forward_3m_usd: 2445.00,
    change_24h_pct: -0.42, change_7d_pct: +1.20,
    w52_high: 2680, w52_low: 2050,
    trend: 'flat',
    aud_per_g: baseToAUDg(2418.00),     // 0.003787
    aud_per_kg: baseToAUDg(2418.00) * 1000,
    dominance: 'Volume weight',
  },
  tin: {
    symbol: 'SN', name: 'Tin', exchange: 'LME', unit: 'USD/t',
    spot_usd: 31240.00, forward_3m_usd: 30800.00,
    change_24h_pct: +2.61, change_7d_pct: +5.80,
    w52_high: 33500, w52_low: 24100,
    trend: 'up',
    aud_per_g: baseToAUDg(31240.00),    // 0.04892
    aud_per_kg: baseToAUDg(31240.00) * 1000,
    dominance: 'Solder / PCB',
  },
  nickel: {
    symbol: 'NI', name: 'Nickel', exchange: 'LME', unit: 'USD/t',
    spot_usd: 17420.00, forward_3m_usd: 17200.00,
    change_24h_pct: -1.14, change_7d_pct: -2.80,
    w52_high: 21000, w52_low: 15800,
    trend: 'down',
    aud_per_g: baseToAUDg(17420.00),    // 0.02728
    aud_per_kg: baseToAUDg(17420.00) * 1000,
    dominance: 'Battery / connectors',
  },
  gold: {
    symbol: 'XAU', name: 'Gold', exchange: 'CME', unit: 'USD/ozt',
    spot_usd: 3284.20, forward_3m_usd: 3310.00,
    change_24h_pct: +0.68, change_7d_pct: +2.14,
    w52_high: 3480, w52_low: 2010,
    trend: 'up',
    aud_per_g: preciousToAUDg(3284.20), // 165.47
    aud_per_kg: preciousToAUDg(3284.20) * 1000,
    dominance: 'High-value driver',
  },
  silver: {
    symbol: 'XAG', name: 'Silver', exchange: 'CME', unit: 'USD/ozt',
    spot_usd: 33.84, forward_3m_usd: 34.20,
    change_24h_pct: +1.24, change_7d_pct: +4.80,
    w52_high: 36.20, w52_low: 22.40,
    trend: 'up',
    aud_per_g: preciousToAUDg(33.84),   // 1.7041
    aud_per_kg: preciousToAUDg(33.84) * 1000,
    dominance: 'Contact surfaces',
  },
  palladium: {
    symbol: 'XPD', name: 'Palladium', exchange: 'CME', unit: 'USD/ozt',
    spot_usd: 1124.80, forward_3m_usd: 1080.00,
    change_24h_pct: -2.42, change_7d_pct: -4.20,
    w52_high: 1480, w52_low: 840,
    trend: 'down',
    aud_per_g: preciousToAUDg(1124.80), // 56.63
    aud_per_kg: preciousToAUDg(1124.80) * 1000,
    dominance: 'Catalytic / capacitors',
  },
}

// ── Feed Status ───────────────────────────────────────────────────────────────
export const FEED_STATUS = [
  { id: 'lme',           label: 'LME Feed',         status: 'Live',     latency_ms: 420,  last_ping: '2026-05-28T10:18:02Z', records_today: 4820, metals: ['copper','aluminium','tin','nickel'] },
  { id: 'cme',           label: 'CME Feed',          status: 'Live',     latency_ms: 310,  last_ping: '2026-05-28T10:18:01Z', records_today: 2140, metals: ['gold','silver','palladium'] },
  { id: 'fx',            label: 'FX / RBA',          status: 'Live',     latency_ms: 180,  last_ping: '2026-05-28T10:15:00Z', records_today: 880,  metals: [] },
  { id: 'scrap_au',      label: 'AU Scrap Dealers',  status: 'Live',     latency_ms: 1840, last_ping: '2026-05-28T09:00:00Z', records_today: 312,  metals: ['copper','aluminium','tin','nickel'] },
  { id: 'competitor',    label: 'Competitor Offers', status: 'Stale',    latency_ms: null, last_ping: '2026-05-27T18:00:00Z', records_today: 48,   metals: [] },
  { id: 'news_sentiment',label: 'News Sentiment NLP',status: 'Live',     latency_ms: 2100, last_ping: '2026-05-28T10:12:00Z', records_today: 184,  metals: ['copper','gold','palladium','nickel'] },
]

// ── Scrap Feeds — Australian Recyclers ────────────────────────────────────────
export const SCRAP_FEEDS = [
  // Dealer, material, grade, AUD/kg
  { dealer: 'Sims Metal Management',  material: 'copper',    grade: 'A', aud_per_kg: 9.84,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Sims Metal Management',  material: 'copper',    grade: 'B', aud_per_kg: 8.62,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Sims Metal Management',  material: 'aluminium', grade: 'A', aud_per_kg: 2.14,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Sims Metal Management',  material: 'aluminium', grade: 'B', aud_per_kg: 1.88,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Sims Metal Management',  material: 'tin',       grade: 'A', aud_per_kg: 38.40, updated: '2026-05-28T09:00Z' },
  { dealer: 'Sims Metal Management',  material: 'nickel',    grade: 'A', aud_per_kg: 17.80, updated: '2026-05-28T09:00Z' },

  { dealer: 'Cleanaway Metals',       material: 'copper',    grade: 'A', aud_per_kg: 9.92,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Cleanaway Metals',       material: 'copper',    grade: 'B', aud_per_kg: 8.40,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Cleanaway Metals',       material: 'aluminium', grade: 'A', aud_per_kg: 2.08,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Cleanaway Metals',       material: 'aluminium', grade: 'B', aud_per_kg: 1.72,  updated: '2026-05-28T09:00Z' },
  { dealer: 'Cleanaway Metals',       material: 'tin',       grade: 'A', aud_per_kg: 39.10, updated: '2026-05-28T09:00Z' },
  { dealer: 'Cleanaway Metals',       material: 'nickel',    grade: 'A', aud_per_kg: 18.20, updated: '2026-05-28T09:00Z' },

  { dealer: 'Visy Industries',        material: 'copper',    grade: 'A', aud_per_kg: 9.76,  updated: '2026-05-28T08:30Z' },
  { dealer: 'Visy Industries',        material: 'copper',    grade: 'B', aud_per_kg: 8.55,  updated: '2026-05-28T08:30Z' },
  { dealer: 'Visy Industries',        material: 'aluminium', grade: 'A', aud_per_kg: 2.18,  updated: '2026-05-28T08:30Z' },
  { dealer: 'Visy Industries',        material: 'tin',       grade: 'A', aud_per_kg: 37.90, updated: '2026-05-28T08:30Z' },

  { dealer: 'Precious Metal Recovery', material: 'gold',     grade: 'A', aud_per_kg: 153200, updated: '2026-05-28T09:15Z' },
  { dealer: 'Precious Metal Recovery', material: 'silver',   grade: 'A', aud_per_kg: 1540,   updated: '2026-05-28T09:15Z' },
  { dealer: 'Precious Metal Recovery', material: 'palladium',grade: 'A', aud_per_kg: 48400,  updated: '2026-05-28T09:15Z' },

  { dealer: 'Metalrecycle AU',         material: 'gold',     grade: 'A', aud_per_kg: 155800, updated: '2026-05-28T09:00Z' },
  { dealer: 'Metalrecycle AU',         material: 'silver',   grade: 'A', aud_per_kg: 1560,   updated: '2026-05-28T09:00Z' },
  { dealer: 'Metalrecycle AU',         material: 'palladium',grade: 'A', aud_per_kg: 49100,  updated: '2026-05-28T09:00Z' },
]

// ── Competitor Intelligence ───────────────────────────────────────────────────
export const COMPETITOR_OFFERS = [
  // device_category, competitor, their_offer_aud, our_offer_aud, spread_pct (positive = we pay more)
  { device: 'Smartphone',       competitor: 'ReCell AU',         their_offer: 3.20, our_offer: 5.40, spread_pct: +68.8, win_rate: 78 },
  { device: 'Smartphone',       competitor: 'TechRecycle Sydney',their_offer: 4.80, our_offer: 5.40, spread_pct: +12.5, win_rate: 62 },
  { device: 'Smartphone',       competitor: 'GreenChip Recycle', their_offer: 5.60, our_offer: 5.40, spread_pct:  -3.6, win_rate: 44 },
  { device: 'Laptop',           competitor: 'ReCell AU',         their_offer: 22.40,our_offer: 30.20,spread_pct: +34.8, win_rate: 81 },
  { device: 'Laptop',           competitor: 'TechRecycle Sydney',their_offer: 28.80,our_offer: 30.20,spread_pct:  +4.9, win_rate: 56 },
  { device: 'Laptop',           competitor: 'GreenChip Recycle', their_offer: 31.50,our_offer: 30.20,spread_pct:  -4.1, win_rate: 48 },
  { device: 'Desktop PC',       competitor: 'ReCell AU',         their_offer: 14.80,our_offer: 19.60,spread_pct: +32.4, win_rate: 76 },
  { device: 'Desktop PC',       competitor: 'TechRecycle Sydney',their_offer: 18.20,our_offer: 19.60,spread_pct:  +7.7, win_rate: 59 },
  { device: 'Tablet',           competitor: 'ReCell AU',         their_offer: 6.20, our_offer: 8.80, spread_pct: +41.9, win_rate: 82 },
  { device: 'Tablet',           competitor: 'TechRecycle Sydney',their_offer: 8.00, our_offer: 8.80, spread_pct: +10.0, win_rate: 61 },
  { device: 'TV / Monitor',     competitor: 'ReCell AU',         their_offer: 2.10, our_offer: 4.20, spread_pct: +100,  win_rate: 88 },
  { device: 'TV / Monitor',     competitor: 'GreenChip Recycle', their_offer: 3.80, our_offer: 4.20, spread_pct: +10.5, win_rate: 65 },
  { device: 'Large Appliance',  competitor: 'Sims Metal',        their_offer: 9.40, our_offer: 13.80,spread_pct: +46.8, win_rate: 74 },
  { device: 'Mixed E-Waste',    competitor: 'ReCell AU',         their_offer: 1.20, our_offer: 1.95, spread_pct: +62.5, win_rate: 84 },
  { device: 'Mixed E-Waste',    competitor: 'TechRecycle Sydney',their_offer: 1.80, our_offer: 1.95, spread_pct:  +8.3, win_rate: 58 },
]

// ── Sentiment Engine ──────────────────────────────────────────────────────────
export const SENTIMENT_FEED = [
  {
    id: 'SNT-0841', published_at: '2026-05-28T09:14:00Z',
    headline: 'China announces $800bn green infrastructure stimulus — copper demand surge expected',
    source: 'Reuters', sentiment_score: +0.84, magnitude: 'High',
    metals: ['copper', 'aluminium', 'nickel'], impact: 'bullish',
  },
  {
    id: 'SNT-0840', published_at: '2026-05-28T08:42:00Z',
    headline: 'Gold hits 3-month high as US inflation data surprises to upside',
    source: 'Bloomberg', sentiment_score: +0.71, magnitude: 'High',
    metals: ['gold', 'silver'], impact: 'bullish',
  },
  {
    id: 'SNT-0839', published_at: '2026-05-28T07:55:00Z',
    headline: 'EV battery transition threatens palladium demand — catalytic converter phase-out timeline accelerated',
    source: 'FT', sentiment_score: -0.68, magnitude: 'High',
    metals: ['palladium'], impact: 'bearish',
  },
  {
    id: 'SNT-0838', published_at: '2026-05-27T22:00:00Z',
    headline: 'LME tin stocks hit 18-month low amid Southeast Asia supply disruptions',
    source: 'Metal Bulletin', sentiment_score: +0.62, magnitude: 'Medium',
    metals: ['tin'], impact: 'bullish',
  },
  {
    id: 'SNT-0837', published_at: '2026-05-27T18:30:00Z',
    headline: 'Australian dollar strengthens against USD — export competitiveness concern for recyclers',
    source: 'AFR', sentiment_score: -0.31, magnitude: 'Low',
    metals: ['copper', 'aluminium', 'gold', 'silver'], impact: 'bearish',
  },
  {
    id: 'SNT-0836', published_at: '2026-05-27T14:10:00Z',
    headline: 'Nickel futures fall on Indonesia ore export ban reversal rumours',
    source: 'Bloomberg', sentiment_score: -0.54, magnitude: 'Medium',
    metals: ['nickel'], impact: 'bearish',
  },
  {
    id: 'SNT-0835', published_at: '2026-05-27T10:00:00Z',
    headline: 'Silver surges as solar panel demand exceeds supply in key Asian markets',
    source: 'Reuters', sentiment_score: +0.78, magnitude: 'High',
    metals: ['silver'], impact: 'bullish',
  },
  {
    id: 'SNT-0834', published_at: '2026-05-27T08:20:00Z',
    headline: 'E-waste recycling volumes up 22% YoY in Australia — positive for secondary metal supply',
    source: 'Recycling Today AU', sentiment_score: +0.45, magnitude: 'Medium',
    metals: ['copper', 'gold', 'silver', 'palladium'], impact: 'mixed',
  },
]

export const MACRO_SIGNALS = [
  { signal: 'USD Index (DXY)',     value: '103.42', trend: 'down',  impact: 'bullish',  metals: ['gold','silver','copper'], note: 'Weak USD lifts commodity prices' },
  { signal: 'China PMI (Mfg)',     value: '52.4',   trend: 'up',   impact: 'bullish',  metals: ['copper','nickel','tin'],  note: 'Expansion signals strong demand' },
  { signal: 'US 10Y Yield',        value: '4.18%',  trend: 'down', impact: 'bullish',  metals: ['gold','silver'],         note: 'Lower yields support precious metals' },
  { signal: 'AUD/USD',             value: '0.6385', trend: 'up',   impact: 'bearish',  metals: ['copper','aluminium'],    note: 'Stronger AUD reduces local payout value' },
  { signal: 'Oil (Brent, USD/bbl)',value: '$81.40', trend: 'flat', impact: 'neutral',  metals: [],                        note: 'Logistics cost stable' },
  { signal: 'EV Adoption Rate AU', value: '18.4%',  trend: 'up',   impact: 'bullish',  metals: ['nickel','copper'],       note: 'Rising EV recycling volumes expected' },
]

// ── Material Composition per Device ──────────────────────────────────────────
// Raw grams per device, before recovery efficiency.
// Recovery efficiency: base metals 0.78, precious metals 0.91
// Component totals are representative of market-mix averages.
export const DEVICE_COMPOSITIONS = {
  smartphone: {
    label: 'Smartphone', unit: 'per device', weight_g: 185, count_in_stream: 42,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 15.0, aluminium: 12.0, tin: 3.5, gold: 0.040, silver: 0.35, palladium: 0.015, nickel: 6.0 },
    logistics_aud: 0.80, processing_aud: 0.60,
    characterisation: 'Au-rich',
  },
  laptop: {
    label: 'Laptop', unit: 'per device', weight_g: 2100, count_in_stream: 18,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 155.0, aluminium: 1200.0, tin: 38.0, gold: 0.38, silver: 2.6, palladium: 0.12, nickel: 48.0 },
    logistics_aud: 2.20, processing_aud: 1.80,
    characterisation: 'Al-dominant, Au-supplemented',
  },
  desktop: {
    label: 'Desktop PC', unit: 'per device', weight_g: 7800, count_in_stream: 8,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 290.0, aluminium: 420.0, tin: 68.0, gold: 0.70, silver: 4.4, palladium: 0.24, nickel: 85.0 },
    logistics_aud: 3.40, processing_aud: 2.60,
    characterisation: 'Cu+Al rich, multi-board Au',
  },
  tablet: {
    label: 'Tablet', unit: 'per device', weight_g: 480, count_in_stream: 24,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 22.0, aluminium: 200.0, tin: 5.5, gold: 0.055, silver: 0.48, palladium: 0.020, nickel: 9.0 },
    logistics_aud: 1.00, processing_aud: 0.80,
    characterisation: 'Al-heavy, moderate Au',
  },
  tv_monitor: {
    label: 'TV / Monitor', unit: 'per device', weight_g: 8200, count_in_stream: 6,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 440.0, aluminium: 820.0, tin: 42.0, gold: 0.10, silver: 1.9, palladium: 0.08, nickel: 62.0 },
    logistics_aud: 4.50, processing_aud: 3.00,
    characterisation: 'Cu+Al bulk, low precious',
  },
  large_appliance: {
    label: 'Large Appliance', unit: 'per device', weight_g: 68000, count_in_stream: 2,
    efficiency: { base: 0.78, precious: 0.91 },
    materials: { copper: 1850.0, aluminium: 8200.0, tin: 125.0, gold: 0.08, silver: 8.8, palladium: 0.05, nickel: 310.0 },
    logistics_aud: 12.00, processing_aud: 8.00,
    characterisation: 'High Cu+Al volume, minimal precious',
  },
  mixed_ewaste: {
    label: 'Mixed E-Waste', unit: 'per kg', weight_g: 1000, count_in_stream: null,
    efficiency: { base: 0.72, precious: 0.86 },
    materials: { copper: 18.0, aluminium: 80.0, tin: 4.2, gold: 0.012, silver: 0.14, palladium: 0.006, nickel: 12.0 },
    logistics_aud: 0.28, processing_aud: 0.22,
    characterisation: 'Mixed grade — variable precious content',
  },
}

// ── Pricing Engine Config (ADMIN ONLY — NEVER EXPOSE TO USERS) ────────────────
export const PRICING_ENGINE_CONFIG = {
  target_margin_min_pct: 20,
  target_margin_max_pct: 45,
  current_margin_pct: 28.4,     // current blended margin
  margin_status: 'Healthy',      // Healthy / Compressed / At Risk
  last_published: '2026-05-28T09:00:00Z',
  valid_until:    '2026-05-28T16:00:00Z',
  next_reprice:   '2026-05-29T09:00:00Z',
  fx_adjustment_pct:    +1.2,   // AUD/USD movement buffer
  logistics_buffer_pct: +5.0,   // logistics cost safety buffer
  sentiment_adjustment_pct: +0.8, // positive sentiment uplift today

  // Per-device engine outputs (margin always internal)
  book: [
    { device: 'smartphone',    gross_recovery: 8.42,  logistics: 1.40, net_recovery: 7.02, margin_pct: 23.1, offer: 5.40, prev_offer: 5.20, trend: 'up' },
    { device: 'laptop',        gross_recovery: 43.18, logistics: 4.00, net_recovery: 39.18,margin_pct: 22.9, offer: 30.20,prev_offer: 29.40,trend: 'up' },
    { device: 'desktop',       gross_recovery: 29.84, logistics: 6.00, net_recovery: 23.84,margin_pct: 17.8, offer: 19.60,prev_offer: 19.60,trend: 'flat' },
    { device: 'tablet',        gross_recovery: 13.02, logistics: 1.80, net_recovery: 11.22,margin_pct: 21.6, offer: 8.80, prev_offer: 8.40, trend: 'up' },
    { device: 'tv_monitor',    gross_recovery: 8.14,  logistics: 7.50, net_recovery: 0.64, margin_pct: 34.4, offer: 4.20, prev_offer: 4.20, trend: 'flat' },
    { device: 'large_appliance',gross_recovery:28.60, logistics: 20.00,net_recovery: 8.60, margin_pct: 37.2, offer: 13.80,prev_offer: 14.20,trend: 'down' },
    { device: 'mixed_ewaste',  gross_recovery: 3.12,  logistics: 0.50, net_recovery: 2.62, margin_pct: 25.6, offer: 1.95, prev_offer: 1.90, trend: 'up' },
  ],
}

// ── Live Pricing Book (PUBLIC SAFE — no margin) ───────────────────────────────
// Derived from PRICING_ENGINE_CONFIG.book — margin fields stripped.
export const PRICING_BOOK = PRICING_ENGINE_CONFIG.book.map(item => ({
  device: item.device,
  label: DEVICE_COMPOSITIONS[item.device]?.label || item.device,
  offer_aud: item.offer,
  prev_offer_aud: item.prev_offer,
  trend: item.trend,
  change_aud: +(item.offer - item.prev_offer).toFixed(2),
  characterisation: DEVICE_COMPOSITIONS[item.device]?.characterisation || '—',
  unit: item.device === 'mixed_ewaste' ? '/kg' : '/unit',
  valid_until: PRICING_ENGINE_CONFIG.valid_until,
}))

// ── Realised Margin History ───────────────────────────────────────────────────
// Admin-only — weekly realised vs target
export const MARGIN_HISTORY = {
  weeks:       ['W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26'],
  realised:    [31.2,  29.8,  32.4,  27.6,  30.1,  28.8,  28.4],
  target_min:  [20,    20,    20,    20,    20,    20,    20],
  target_max:  [45,    45,    45,    45,    45,    45,    45],
  revenue_aud: [42800, 38400, 51200, 34600, 46800, 40200, 38800],
}

// ── Market Alerts ─────────────────────────────────────────────────────────────
export const MARKET_ALERTS = [
  { id: 'ALT-001', severity: 'high',   metal: 'palladium', message: 'Palladium -4.20% 7d — EV transition headwind. Review Pd-heavy device offers.', ts: '2026-05-28T09:05Z' },
  { id: 'ALT-002', severity: 'medium', metal: 'tin',       message: 'Tin +5.80% 7d — LME stock at 18-month low. Consider offer uplift on Sn-heavy batches.', ts: '2026-05-28T09:02Z' },
  { id: 'ALT-003', severity: 'low',    metal: 'gold',      message: 'Gold at 3-month high. Current Au pricing book captures upside.', ts: '2026-05-28T08:45Z' },
  { id: 'ALT-004', severity: 'medium', metal: 'all',       message: 'Competitor feed is 16h stale — last scrape 27 May 18:00. Manual verification recommended.', ts: '2026-05-28T10:00Z' },
]
