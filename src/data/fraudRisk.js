// Fraud + Risk Engine — data layer

export const SIGNAL_TYPES = {
  duplicate_scan: {
    id: 'duplicate_scan', label: 'Duplicate Scan',
    description: 'Same QR/barcode scanned multiple times within a session or short window',
    category: 'deposit', default_weight: 18,
  },
  fake_deposit: {
    id: 'fake_deposit', label: 'Fake Deposit',
    description: 'Deposit composition or weight does not match declared item type',
    category: 'deposit', default_weight: 25,
  },
  abnormal_weight: {
    id: 'abnormal_weight', label: 'Abnormal Weight',
    description: 'Weight reading deviates significantly from expected range for item type',
    category: 'operations', default_weight: 20,
  },
  gps_mismatch: {
    id: 'gps_mismatch', label: 'GPS Mismatch',
    description: 'Pickup or deposit location does not match registered bin/zone coordinates',
    category: 'operations', default_weight: 15,
  },
  referral_abuse: {
    id: 'referral_abuse', label: 'Referral Abuse',
    description: 'Self-referral, circular referral loops, or abnormal referral velocity',
    category: 'account', default_weight: 22,
  },
  payout_abuse: {
    id: 'payout_abuse', label: 'Payout Abuse',
    description: 'Frequent micro-payouts, threshold-splitting, or unusual payout patterns',
    category: 'financial', default_weight: 20,
  },
  suspicious_operator: {
    id: 'suspicious_operator', label: 'Suspicious Operator',
    description: 'Operator manipulating weights, accepting known-fake deposits, or collusion',
    category: 'operations', default_weight: 30,
  },
}

export const RISK_THRESHOLDS = {
  low:      { min: 0,  max: 25,  label: 'Low',      bg: 'bg-eco-100',    text: 'text-eco-700',    border: 'border-eco-200',    bar: 'bg-eco-500'    },
  medium:   { min: 26, max: 50,  label: 'Medium',   bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  bar: 'bg-amber-500'  },
  high:     { min: 51, max: 75,  label: 'High',     bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-500' },
  critical: { min: 76, max: 100, label: 'Critical', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    bar: 'bg-red-500'    },
}

export function riskLevel(score) {
  if (score >= 76) return 'critical'
  if (score >= 51) return 'high'
  if (score >= 26) return 'medium'
  return 'low'
}

export const ACTION_META = {
  hold_payout:   { label: 'Hold Payout',    color: 'amber',  bg: 'bg-amber-100',  text: 'text-amber-800',  btn: 'bg-amber-500 hover:bg-amber-600 text-white'  },
  manual_review: { label: 'Manual Review',  color: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', btn: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
  reject:        { label: 'Reject',         color: 'red',    bg: 'bg-red-50',     text: 'text-red-700',    btn: 'bg-white border border-red-300 text-red-700 hover:bg-red-50' },
  suspend:       { label: 'Suspend',        color: 'red',    bg: 'bg-red-100',    text: 'text-red-800',    btn: 'bg-red-600 hover:bg-red-700 text-white'      },
}

export const RISK_RULES = [
  {
    id: 'RR-001', signal: 'duplicate_scan',
    label: 'Duplicate Scan Detection',
    description: 'Flag if same item barcode is scanned >2 times within 24h by the same user',
    enabled: true, threshold: 2, threshold_unit: 'scans per 24h', threshold_min: 1, threshold_max: 10,
    weight: 18, weight_min: 5, weight_max: 30,
    triggered_30d: 847, true_positive_rate: 0.91, category: 'deposit',
  },
  {
    id: 'RR-002', signal: 'fake_deposit',
    label: 'Composition Mismatch',
    description: 'Flag if scanned item composition deviates >40% from declared weight/type',
    enabled: true, threshold: 40, threshold_unit: '% deviation', threshold_min: 10, threshold_max: 80,
    weight: 25, weight_min: 10, weight_max: 40,
    triggered_30d: 312, true_positive_rate: 0.88, category: 'deposit',
  },
  {
    id: 'RR-003', signal: 'abnormal_weight',
    label: 'Weight Anomaly',
    description: 'Flag if deposit weight is >3 standard deviations from item-type baseline',
    enabled: true, threshold: 3, threshold_unit: 'σ from baseline', threshold_min: 1, threshold_max: 6,
    weight: 20, weight_min: 5, weight_max: 35,
    triggered_30d: 1_204, true_positive_rate: 0.76, category: 'operations',
  },
  {
    id: 'RR-004', signal: 'gps_mismatch',
    label: 'Location Discrepancy',
    description: 'Flag if device GPS is >200m from the registered bin/collection zone',
    enabled: true, threshold: 200, threshold_unit: 'metres', threshold_min: 50, threshold_max: 1000,
    weight: 15, weight_min: 5, weight_max: 25,
    triggered_30d: 2_891, true_positive_rate: 0.62, category: 'operations',
  },
  {
    id: 'RR-005', signal: 'referral_abuse',
    label: 'Referral Velocity Cap',
    description: 'Flag if user generates >8 referrals in 7 days or has circular referral chain',
    enabled: true, threshold: 8, threshold_unit: 'referrals per 7d', threshold_min: 3, threshold_max: 20,
    weight: 22, weight_min: 10, weight_max: 35,
    triggered_30d: 156, true_positive_rate: 0.94, category: 'account',
  },
  {
    id: 'RR-006', signal: 'payout_abuse',
    label: 'Micro-Payout Structuring',
    description: 'Flag if user requests >5 payouts in 48h each just below the review threshold',
    enabled: true, threshold: 5, threshold_unit: 'payouts per 48h', threshold_min: 2, threshold_max: 15,
    weight: 20, weight_min: 10, weight_max: 35,
    triggered_30d: 89, true_positive_rate: 0.97, category: 'financial',
  },
  {
    id: 'RR-007', signal: 'suspicious_operator',
    label: 'Operator Collusion Signal',
    description: 'Flag if operator anomaly-approval rate exceeds 80% over any 7-day window',
    enabled: true, threshold: 80, threshold_unit: '% anomaly approval rate', threshold_min: 50, threshold_max: 95,
    weight: 30, weight_min: 15, weight_max: 40,
    triggered_30d: 24, true_positive_rate: 0.96, category: 'operations',
  },
]

export const RISK_ENTITIES = [
  {
    id: 'ENT-001', type: 'consumer', name: 'Jordan K.', ref: 'USR-40821',
    risk_score: 82, status: 'suspended', active_cases: 2,
    joined: '2024-09-14', last_activity: '2026-05-27',
    total_deposits: 142, flagged_deposits: 38,
    total_payout_aud: 1_840, held_payout_aud: 830, location: 'Melbourne VIC',
    signals: { duplicate_scan: 65, fake_deposit: 90, abnormal_weight: 80, gps_mismatch: 20, referral_abuse: 10, payout_abuse: 30, suspicious_operator: 0 },
  },
  {
    id: 'ENT-002', type: 'consumer', name: 'Priya S.', ref: 'USR-31047',
    risk_score: 67, status: 'review', active_cases: 1,
    joined: '2025-02-20', last_activity: '2026-05-26',
    total_deposits: 88, flagged_deposits: 14,
    total_payout_aud: 940, held_payout_aud: 180, location: 'Sydney NSW',
    signals: { duplicate_scan: 20, fake_deposit: 30, abnormal_weight: 45, gps_mismatch: 80, referral_abuse: 75, payout_abuse: 60, suspicious_operator: 0 },
  },
  {
    id: 'ENT-003', type: 'operator', name: 'FastRecycle Co.', ref: 'OPR-0182',
    risk_score: 74, status: 'review', active_cases: 3,
    joined: '2024-06-01', last_activity: '2026-05-28',
    total_deposits: 4_820, flagged_deposits: 312,
    total_payout_aud: 48_200, held_payout_aud: 6_400, location: 'Brisbane QLD',
    signals: { duplicate_scan: 10, fake_deposit: 40, abnormal_weight: 60, gps_mismatch: 30, referral_abuse: 0, payout_abuse: 45, suspicious_operator: 88 },
  },
  {
    id: 'ENT-004', type: 'consumer', name: 'Marcus T.', ref: 'USR-55203',
    risk_score: 44, status: 'active', active_cases: 1,
    joined: '2025-07-11', last_activity: '2026-05-25',
    total_deposits: 55, flagged_deposits: 7,
    total_payout_aud: 520, held_payout_aud: 0, location: 'Perth WA',
    signals: { duplicate_scan: 30, fake_deposit: 15, abnormal_weight: 55, gps_mismatch: 40, referral_abuse: 0, payout_abuse: 20, suspicious_operator: 0 },
  },
  {
    id: 'ENT-005', type: 'merchant', name: 'QuickBuy Electronics', ref: 'MRC-0047',
    risk_score: 58, status: 'review', active_cases: 1,
    joined: '2025-11-03', last_activity: '2026-05-28',
    total_deposits: 0, flagged_deposits: 0,
    total_payout_aud: 12_400, held_payout_aud: 2_100, location: 'Adelaide SA',
    signals: { duplicate_scan: 0, fake_deposit: 0, abnormal_weight: 0, gps_mismatch: 10, referral_abuse: 20, payout_abuse: 75, suspicious_operator: 40 },
  },
  {
    id: 'ENT-006', type: 'operator', name: 'GreenLoop Ops', ref: 'OPR-0094',
    risk_score: 18, status: 'active', active_cases: 0,
    joined: '2024-03-22', last_activity: '2026-05-28',
    total_deposits: 9_120, flagged_deposits: 44,
    total_payout_aud: 91_200, held_payout_aud: 0, location: 'Melbourne VIC',
    signals: { duplicate_scan: 5, fake_deposit: 10, abnormal_weight: 20, gps_mismatch: 15, referral_abuse: 0, payout_abuse: 5, suspicious_operator: 12 },
  },
]

export const FRAUD_CASES = [
  {
    id: 'FC-2841', entity_id: 'ENT-001', entity_name: 'Jordan K.', entity_type: 'consumer', entity_ref: 'USR-40821',
    risk_score: 82, primary_signal: 'fake_deposit', signals_triggered: ['duplicate_scan', 'fake_deposit', 'abnormal_weight'],
    status: 'suspended', priority: 'critical', opened: '2026-05-24', last_updated: '2026-05-27',
    assigned_to: 'Risk Team A', amount_at_risk_aud: 830,
    description: 'User submitted 14 deposits in 48h with item weights averaging 340% above category baseline. Barcode re-use detected on 6 items.',
    evidence: [
      { ts: '2026-05-24T09:12Z', type: 'duplicate_scan', detail: 'Barcode ECO-4821 scanned 4× in 6h across same zone', severity: 'high' },
      { ts: '2026-05-24T11:30Z', type: 'abnormal_weight', detail: 'Claimed iPhone 14 Pro: 940g vs 240g baseline (+292%)', severity: 'critical' },
      { ts: '2026-05-24T14:55Z', type: 'fake_deposit', detail: 'Composition scan: 80% non-electronic material in declared electronics deposit', severity: 'critical' },
      { ts: '2026-05-25T08:20Z', type: 'duplicate_scan', detail: 'Barcode ECO-4899 scanned 3× across 2 zones', severity: 'high' },
      { ts: '2026-05-27T10:00Z', type: 'payout_abuse', detail: 'Payout request $830 — held pending review', severity: 'medium' },
    ],
    actions_taken: [
      { ts: '2026-05-24T15:30Z', action: 'hold_payout', actor: 'Auto-Rule RR-002', note: 'Automatic hold triggered by composition mismatch threshold' },
      { ts: '2026-05-25T09:00Z', action: 'manual_review', actor: 'admin@ecobin.au', note: 'Escalated to Risk Team A for full review' },
      { ts: '2026-05-27T11:00Z', action: 'suspend', actor: 'risk@ecobin.au', note: 'Account suspended pending investigation outcome' },
    ],
    integration_refs: { wallet: ['TXN-88201', 'TXN-88199'], operations: ['DEP-40821-14'], settlement: ['STL-2026-05-24'], pricing: ['PCG-QUARANTINE-4821'] },
  },
  {
    id: 'FC-2836', entity_id: 'ENT-002', entity_name: 'Priya S.', entity_type: 'consumer', entity_ref: 'USR-31047',
    risk_score: 67, primary_signal: 'referral_abuse', signals_triggered: ['referral_abuse', 'gps_mismatch', 'payout_abuse'],
    status: 'open', priority: 'high', opened: '2026-05-22', last_updated: '2026-05-26',
    assigned_to: 'Risk Team B', amount_at_risk_aud: 180,
    description: '11 referrals generated in 5 days, all from the same suburb. GPS data shows deposits from a location 1.8km from the nearest registered zone.',
    evidence: [
      { ts: '2026-05-22T14:00Z', type: 'referral_abuse', detail: '11 referrals generated in 5 days (threshold: 8/7d)', severity: 'high' },
      { ts: '2026-05-23T10:20Z', type: 'gps_mismatch', detail: 'Deposit GPS: -33.8921, 151.2041 — nearest zone 1.8km away', severity: 'high' },
      { ts: '2026-05-25T16:40Z', type: 'payout_abuse', detail: '3 payout requests in 24h: $58, $62, $60 (structuring pattern)', severity: 'medium' },
    ],
    actions_taken: [
      { ts: '2026-05-22T14:30Z', action: 'hold_payout', actor: 'Auto-Rule RR-005', note: 'Referral velocity exceeded — payouts held automatically' },
      { ts: '2026-05-23T09:00Z', action: 'manual_review', actor: 'Risk Team B', note: 'GPS evidence added, awaiting operator confirmation' },
    ],
    integration_refs: { wallet: ['TXN-87640'], operations: ['DEP-31047-08'], settlement: [], pricing: [] },
  },
  {
    id: 'FC-2829', entity_id: 'ENT-003', entity_name: 'FastRecycle Co.', entity_type: 'operator', entity_ref: 'OPR-0182',
    risk_score: 74, primary_signal: 'suspicious_operator', signals_triggered: ['suspicious_operator', 'abnormal_weight', 'fake_deposit'],
    status: 'open', priority: 'high', opened: '2026-05-18', last_updated: '2026-05-28',
    assigned_to: 'Compliance', amount_at_risk_aud: 6_400,
    description: 'Operator approved 87% of flagged weight-anomaly deposits at Brisbane South zone over 10 days. Pattern consistent with collusion with repeat offenders.',
    evidence: [
      { ts: '2026-05-18T09:00Z', type: 'suspicious_operator', detail: 'Anomaly approval rate: 87% over 10d (threshold: 80%)', severity: 'critical' },
      { ts: '2026-05-19T11:30Z', type: 'abnormal_weight', detail: '142 deposits avg +180% weight vs baseline at Brisbane South', severity: 'high' },
      { ts: '2026-05-21T15:00Z', type: 'fake_deposit', detail: '34 composition mismatches approved without override reason', severity: 'high' },
      { ts: '2026-05-25T08:00Z', type: 'suspicious_operator', detail: 'Same 4 consumer accounts responsible for 68% of anomalous deposits', severity: 'critical' },
    ],
    actions_taken: [
      { ts: '2026-05-18T12:00Z', action: 'hold_payout', actor: 'Auto-Rule RR-007', note: 'Operator settlement held pending compliance review' },
      { ts: '2026-05-20T09:00Z', action: 'manual_review', actor: 'compliance@ecobin.au', note: 'Full deposit audit initiated for Brisbane South zone' },
    ],
    integration_refs: { wallet: [], operations: ['OPR-0182-BNE-SOUTH'], settlement: ['STL-OPR-0182-MAY'], pricing: ['PCG-QUARANTINE-BNE-SOUTH'] },
  },
  {
    id: 'FC-2820', entity_id: 'ENT-004', entity_name: 'Marcus T.', entity_type: 'consumer', entity_ref: 'USR-55203',
    risk_score: 44, primary_signal: 'abnormal_weight', signals_triggered: ['abnormal_weight', 'gps_mismatch'],
    status: 'open', priority: 'medium', opened: '2026-05-20', last_updated: '2026-05-25',
    assigned_to: 'Unassigned', amount_at_risk_aud: 0,
    description: 'Weight anomaly on 3 deposits within escalation range. GPS consistent but showing 280m deviation from zone boundary.',
    evidence: [
      { ts: '2026-05-20T13:10Z', type: 'abnormal_weight', detail: 'Claimed tablet: 1,240g vs 520g baseline (+138%)', severity: 'medium' },
      { ts: '2026-05-22T09:40Z', type: 'gps_mismatch', detail: 'Device GPS 280m from zone ECO-Z-0018 boundary', severity: 'low' },
    ],
    actions_taken: [],
    integration_refs: { wallet: [], operations: ['DEP-55203-03'], settlement: [], pricing: [] },
  },
  {
    id: 'FC-2815', entity_id: 'ENT-005', entity_name: 'QuickBuy Electronics', entity_type: 'merchant', entity_ref: 'MRC-0047',
    risk_score: 58, primary_signal: 'payout_abuse', signals_triggered: ['payout_abuse', 'suspicious_operator'],
    status: 'open', priority: 'high', opened: '2026-05-15', last_updated: '2026-05-28',
    assigned_to: 'Risk Team A', amount_at_risk_aud: 2_100,
    description: 'Merchant initiated 12 partial redemption payouts in 72h, each just below the $200 auto-approval threshold. Suspected structuring.',
    evidence: [
      { ts: '2026-05-15T10:00Z', type: 'payout_abuse', detail: '12 payout requests in 72h: avg $175 (threshold $200)', severity: 'critical' },
      { ts: '2026-05-17T14:00Z', type: 'payout_abuse', detail: 'Total structured amount: $2,100 across 12 requests', severity: 'critical' },
    ],
    actions_taken: [
      { ts: '2026-05-15T10:30Z', action: 'hold_payout', actor: 'Auto-Rule RR-006', note: 'Micro-payout structuring detected — all pending payouts held' },
      { ts: '2026-05-16T09:00Z', action: 'manual_review', actor: 'Risk Team A', note: 'Initiated merchant verification review' },
    ],
    integration_refs: { wallet: ['TXN-86800', 'TXN-86801', 'TXN-86802'], operations: [], settlement: ['STL-MRC-0047-MAY'], pricing: [] },
  },
]

export const ALERT_QUEUE = [
  {
    id: 'ALT-4091', ts: '2026-05-28T07:42Z', signal: 'duplicate_scan',
    entity_id: 'ENT-NEW-1', entity_name: 'Alex W.', entity_ref: 'USR-61022', entity_type: 'consumer',
    risk_score: 71, message: 'Barcode ECO-5512 scanned 5× across 3 sessions in 90 minutes',
    recommended_action: 'hold_payout', status: 'new', auto_actioned: false, location: 'Melbourne VIC',
  },
  {
    id: 'ALT-4090', ts: '2026-05-28T06:18Z', signal: 'abnormal_weight',
    entity_id: 'ENT-NEW-2', entity_name: 'BioCycle Ops', entity_ref: 'OPR-0241', entity_type: 'operator',
    risk_score: 55, message: 'Weight readings at Sydney West zone averaging +220% above baseline for CPU deposits',
    recommended_action: 'manual_review', status: 'new', auto_actioned: false, location: 'Sydney NSW',
  },
  {
    id: 'ALT-4088', ts: '2026-05-27T22:05Z', signal: 'payout_abuse',
    entity_id: 'ENT-001', entity_name: 'Jordan K.', entity_ref: 'USR-40821', entity_type: 'consumer',
    risk_score: 82, message: 'Suspended user attempted payout request via secondary account USR-61244',
    recommended_action: 'reject', status: 'actioned', auto_actioned: true, location: 'Melbourne VIC',
  },
  {
    id: 'ALT-4085', ts: '2026-05-27T14:30Z', signal: 'gps_mismatch',
    entity_id: 'ENT-NEW-3', entity_name: 'Ravi M.', entity_ref: 'USR-72304', entity_type: 'consumer',
    risk_score: 31, message: 'Device GPS 680m from registered zone ECO-Z-0024 during deposit scan',
    recommended_action: 'manual_review', status: 'reviewing', auto_actioned: false, location: 'Brisbane QLD',
  },
  {
    id: 'ALT-4082', ts: '2026-05-27T11:00Z', signal: 'referral_abuse',
    entity_id: 'ENT-NEW-4', entity_name: 'Chloe B.', entity_ref: 'USR-48819', entity_type: 'consumer',
    risk_score: 63, message: '9 referrals in 4 days — circular chain detected involving 3 accounts',
    recommended_action: 'hold_payout', status: 'new', auto_actioned: false, location: 'Melbourne VIC',
  },
  {
    id: 'ALT-4079', ts: '2026-05-26T16:45Z', signal: 'suspicious_operator',
    entity_id: 'ENT-003', entity_name: 'FastRecycle Co.', entity_ref: 'OPR-0182', entity_type: 'operator',
    risk_score: 74, message: 'Anomaly approval rate climbed to 87% at Brisbane South — new evidence added to FC-2829',
    recommended_action: 'manual_review', status: 'actioned', auto_actioned: false, location: 'Brisbane QLD',
  },
  {
    id: 'ALT-4076', ts: '2026-05-26T09:20Z', signal: 'fake_deposit',
    entity_id: 'ENT-NEW-5', entity_name: 'Tom H.', entity_ref: 'USR-53001', entity_type: 'consumer',
    risk_score: 48, message: 'Composition scan: 65% non-electronic content in declared laptop deposit',
    recommended_action: 'manual_review', status: 'dismissed', auto_actioned: false, location: 'Adelaide SA',
  },
]

export const PAYOUT_HOLDS = [
  { id: 'PH-001', entity_name: 'Jordan K.',          entity_ref: 'USR-40821', entity_type: 'consumer', amount_aud: 830,   reason: 'fake_deposit',        case_id: 'FC-2841', held_since: '2026-05-24', status: 'held' },
  { id: 'PH-002', entity_name: 'Priya S.',            entity_ref: 'USR-31047', entity_type: 'consumer', amount_aud: 180,   reason: 'referral_abuse',      case_id: 'FC-2836', held_since: '2026-05-22', status: 'held' },
  { id: 'PH-003', entity_name: 'FastRecycle Co.',     entity_ref: 'OPR-0182',  entity_type: 'operator', amount_aud: 6_400, reason: 'suspicious_operator', case_id: 'FC-2829', held_since: '2026-05-18', status: 'held' },
  { id: 'PH-004', entity_name: 'QuickBuy Electronics',entity_ref: 'MRC-0047',  entity_type: 'merchant', amount_aud: 2_100, reason: 'payout_abuse',        case_id: 'FC-2815', held_since: '2026-05-15', status: 'held' },
]

export const FRAUD_STATS = {
  total_cases_open: 4,
  total_cases_30d: 18,
  total_resolved_30d: 14,
  critical_open: 1,
  high_open: 3,
  medium_open: 1,
  total_held_aud: 9_510,
  auto_actioned_30d: 42,
  false_positive_rate: 0.08,
  fraud_prevented_aud_30d: 28_400,
  deposits_quarantined_pricing: 48,
  settlement_holds: 2,
  wallet_freezes: 5,
  score_distribution: [
    { range: '0–25',   label: 'Low',      count: 12_840, pct: 84, bar: 'bg-eco-500'    },
    { range: '26–50',  label: 'Medium',   count: 1_620,  pct: 11, bar: 'bg-amber-500'  },
    { range: '51–75',  label: 'High',     count: 580,    pct: 4,  bar: 'bg-orange-500' },
    { range: '76–100', label: 'Critical', count: 140,    pct: 1,  bar: 'bg-red-500'    },
  ],
  signals_30d: [
    { signal: 'gps_mismatch',       count: 2_891, true_positive_rate: 0.62 },
    { signal: 'abnormal_weight',     count: 1_204, true_positive_rate: 0.76 },
    { signal: 'duplicate_scan',      count: 847,   true_positive_rate: 0.91 },
    { signal: 'fake_deposit',        count: 312,   true_positive_rate: 0.88 },
    { signal: 'referral_abuse',      count: 156,   true_positive_rate: 0.94 },
    { signal: 'payout_abuse',        count: 89,    true_positive_rate: 0.97 },
    { signal: 'suspicious_operator', count: 24,    true_positive_rate: 0.96 },
  ],
  daily_alerts_7d: [
    { day: 'Mon', count: 18 }, { day: 'Tue', count: 24 }, { day: 'Wed', count: 21 },
    { day: 'Thu', count: 31 }, { day: 'Fri', count: 28 }, { day: 'Sat', count: 14 }, { day: 'Sun', count: 12 },
  ],
}
