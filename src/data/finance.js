// ── Enterprise Financial Layer — Mock Data ──────────────────────────────────

export const CONSUMER_WALLET = {
  user_id: 'USR-0042',
  name: 'Sarah M.',
  kyc_status: 'Verified',
  account_age_days: 312,
  wallets: {
    points: {
      type: 'points',
      balance_pts: 4820,
      rate_aud: 0.005,
      label: 'Eco Points',
      note: 'NOT REDEEMABLE AS CASH — use for rewards only',
    },
    pending: {
      type: 'pending',
      balance_aud: 38.40,
      label: 'Pending Cash',
      note: 'Held during fraud review period',
      releases: [
        { amount: 12.60, release_at: '2026-06-01', source: 'JOB-2041 · Bondi station drop-off' },
        { amount: 15.80, release_at: '2026-06-03', source: 'JOB-2048 · Newtown community bin' },
        { amount: 10.00, release_at: '2026-06-07', source: 'JOB-2055 · Surry Hills bin scan' },
      ],
    },
    available: {
      type: 'available',
      balance_aud: 156.20,
      label: 'Available Cash',
      note: 'Ready to withdraw',
      preferred_rail: 'payid',
    },
    reserve: {
      type: 'reserve',
      balance_aud: 25.00,
      label: 'Reserve Hold',
      note: 'Anti-fraud hold — account flagged for review',
      reason: 'Rapid deposit pattern detected — 3 pickups within 2 hrs',
      held_since: '2026-05-20',
      release_at: '2026-05-27',
      status: 'LOCKED',
    },
  },
  payment_rails: {
    payid: { configured: true, identifier: 'sarah.m@payid.com.au', last_used: '2026-05-18' },
    bank: { configured: true, bsb: '062-000', account: '****4821', last_used: '2026-05-01' },
    stripe: { configured: false },
  },
  withdrawal_history: [
    { id: 'WD-1041', amount: 80.00, rail: 'payid', status: 'Completed', date: '2026-05-18' },
    { id: 'WD-0984', amount: 45.00, rail: 'bank',  status: 'Completed', date: '2026-05-01' },
    { id: 'WD-0871', amount: 120.00, rail: 'payid', status: 'Completed', date: '2026-04-14' },
  ],
}

// ── Ledger Accounts ──────────────────────────────────────────────────────────

export const LEDGER_ACCOUNTS = {
  // Assets
  MAIN_BANK:          { id: 'MAIN_BANK',          name: 'Main Bank Account (ANZ)',       type: 'Asset',     balance: 412850.00 },
  STRIPE_BALANCE:     { id: 'STRIPE_BALANCE',     name: 'Stripe Connect Balance',        type: 'Asset',     balance: 38420.50 },
  AIRWALLEX_BALANCE:  { id: 'AIRWALLEX_BALANCE',  name: 'Airwallex Float',               type: 'Asset',     balance: 24180.00 },
  // Liabilities
  CONSUMER_PENDING:   { id: 'CONSUMER_PENDING',   name: 'Consumer Pending Wallets',      type: 'Liability', balance: 48620.80 },
  CONSUMER_AVAILABLE: { id: 'CONSUMER_AVAILABLE', name: 'Consumer Available Wallets',    type: 'Liability', balance: 312440.60 },
  RESERVE_FUND:       { id: 'RESERVE_FUND',       name: 'Anti-Fraud Reserve Fund',       type: 'Liability', balance: 18200.00 },
  POINTS_LIABILITY:   { id: 'POINTS_LIABILITY',   name: 'Eco Points Liability',          type: 'Liability', balance: 24100.00 },
  OPERATOR_PAYABLE:   { id: 'OPERATOR_PAYABLE',   name: 'Operator Settlement Payable',   type: 'Liability', balance: 32180.00 },
  RECYCLER_PAYABLE:   { id: 'RECYCLER_PAYABLE',   name: 'Recycler Payout Payable',       type: 'Liability', balance: 61400.00 },
  PLATFORM_FLOAT:     { id: 'PLATFORM_FLOAT',     name: 'Platform Float Reserve',        type: 'Liability', balance: 14820.00 },
  // Income / Expense
  PLATFORM_REVENUE:   { id: 'PLATFORM_REVENUE',   name: 'Platform Revenue',              type: 'Income',    balance: 284600.00 },
  PAYMENT_FEES:       { id: 'PAYMENT_FEES',       name: 'Payment Processing Fees',       type: 'Expense',   balance: 12840.00 },
}

// ── Double-Entry Ledger Entries ───────────────────────────────────────────────
// Every entry: debit account debited, credit account credited, amounts must balance.

export const LEDGER_ENTRIES = [
  {
    id: 'JRN-8801', date: '2026-05-27', description: 'Consumer deposit — Bondi bin scan JOB-2055',
    debit:  { account: 'STRIPE_BALANCE',     amount: 10.00 },
    credit: { account: 'CONSUMER_PENDING',   amount: 10.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8800', date: '2026-05-27', description: 'Anti-fraud hold — reserve transfer USR-0042',
    debit:  { account: 'CONSUMER_AVAILABLE', amount: 25.00 },
    credit: { account: 'RESERVE_FUND',       amount: 25.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8798', date: '2026-05-26', description: 'Pending release — 7-day hold cleared JOB-2041',
    debit:  { account: 'CONSUMER_PENDING',   amount: 12.60 },
    credit: { account: 'CONSUMER_AVAILABLE', amount: 12.60 },
    status: 'Posted',
  },
  {
    id: 'JRN-8795', date: '2026-05-26', description: 'Consumer withdrawal via PayID — USR-0042',
    debit:  { account: 'CONSUMER_AVAILABLE', amount: 80.00 },
    credit: { account: 'MAIN_BANK',          amount: 80.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8794', date: '2026-05-26', description: 'Stripe processing fee — WD-1041',
    debit:  { account: 'PAYMENT_FEES',       amount: 0.30 },
    credit: { account: 'STRIPE_BALANCE',     amount: 0.30 },
    status: 'Posted',
  },
  {
    id: 'JRN-8790', date: '2026-05-25', description: 'Recycler settlement payout — Visy Industries STE-001',
    debit:  { account: 'RECYCLER_PAYABLE',   amount: 24800.00 },
    credit: { account: 'MAIN_BANK',          amount: 24800.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8788', date: '2026-05-25', description: 'Platform fee recognition — STE-001 (5%)',
    debit:  { account: 'RECYCLER_PAYABLE',   amount: 1380.00 },
    credit: { account: 'PLATFORM_REVENUE',   amount: 1380.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8785', date: '2026-05-24', description: 'Operator settlement disbursement — OP-001 May cycle',
    debit:  { account: 'OPERATOR_PAYABLE',   amount: 8420.00 },
    credit: { account: 'AIRWALLEX_BALANCE',  amount: 8420.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8782', date: '2026-05-24', description: 'Points issued — 1200 pts × $0.005 = $6.00 liability',
    debit:  { account: 'PLATFORM_REVENUE',   amount: 6.00 },
    credit: { account: 'POINTS_LIABILITY',   amount: 6.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8780', date: '2026-05-23', description: 'Recycler material sale — Cleanaway RSE-002 gross',
    debit:  { account: 'MAIN_BANK',          amount: 18600.00 },
    credit: { account: 'RECYCLER_PAYABLE',   amount: 18600.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8778', date: '2026-05-23', description: 'Consumer deposit batch — 148 transactions via Stripe',
    debit:  { account: 'STRIPE_BALANCE',     amount: 2840.60 },
    credit: { account: 'CONSUMER_PENDING',   amount: 2840.60 },
    status: 'Posted',
  },
  {
    id: 'JRN-8775', date: '2026-05-22', description: 'Airwallex sweep to main bank — weekly settlement',
    debit:  { account: 'MAIN_BANK',          amount: 15000.00 },
    credit: { account: 'AIRWALLEX_BALANCE',  amount: 15000.00 },
    status: 'Posted',
  },
  {
    id: 'JRN-8770', date: '2026-05-21', description: 'Reversal — disputed pickup JOB-1984 — USR-0011',
    debit:  { account: 'CONSUMER_AVAILABLE', amount: 18.40 },
    credit: { account: 'CONSUMER_PENDING',   amount: 18.40 },
    status: 'Reversed',
  },
  {
    id: 'JRN-8768', date: '2026-05-20', description: 'Stripe batch fee reconciliation — May week 3',
    debit:  { account: 'PAYMENT_FEES',       amount: 184.20 },
    credit: { account: 'STRIPE_BALANCE',     amount: 184.20 },
    status: 'Posted',
  },
  {
    id: 'JRN-8760', date: '2026-05-19', description: 'Platform float top-up — treasury transfer',
    debit:  { account: 'MAIN_BANK',          amount: 5000.00 },
    credit: { account: 'PLATFORM_FLOAT',     amount: 5000.00 },
    status: 'Posted',
  },
]

// ── Payout Queue ─────────────────────────────────────────────────────────────

export const PAYOUT_QUEUE = [
  {
    id: 'PO-4401', user_id: 'USR-0188', name: 'James K.', amount: 420.00, rail: 'bank',
    submitted_at: '2026-05-27T09:14:00Z', status: 'Manual Review',
    reason: 'Amount exceeds $200 auto-approval threshold',
    kyc: 'Verified', account_age_days: 45, prior_withdrawals: 2,
    risk_score: 42,
  },
  {
    id: 'PO-4400', user_id: 'USR-0301', name: 'Priya S.', amount: 85.00, rail: 'payid',
    submitted_at: '2026-05-27T08:52:00Z', status: 'Approved',
    reason: 'Auto-approved — low risk',
    kyc: 'Verified', account_age_days: 180, prior_withdrawals: 14,
    risk_score: 8,
  },
  {
    id: 'PO-4398', user_id: 'USR-0044', name: 'Chen W.', amount: 310.00, rail: 'payid',
    submitted_at: '2026-05-27T07:30:00Z', status: 'Manual Review',
    reason: 'Rapid accumulation pattern — 8 pickups in 6 hrs',
    kyc: 'Verified', account_age_days: 12, prior_withdrawals: 0,
    risk_score: 71,
  },
  {
    id: 'PO-4395', user_id: 'USR-0092', name: 'Fatima A.', amount: 55.20, rail: 'payid',
    submitted_at: '2026-05-26T16:10:00Z', status: 'Completed',
    reason: 'Auto-approved — trusted account',
    kyc: 'Verified', account_age_days: 420, prior_withdrawals: 38,
    risk_score: 4,
  },
  {
    id: 'PO-4390', user_id: 'USR-0108', name: 'Marcus T.', amount: 195.00, rail: 'bank',
    submitted_at: '2026-05-26T11:45:00Z', status: 'Rejected',
    reason: 'KYC documents expired — account suspended',
    kyc: 'Expired', account_age_days: 94, prior_withdrawals: 7,
    risk_score: 85,
  },
  {
    id: 'PO-4388', user_id: 'USR-0219', name: 'Lena R.', amount: 40.00, rail: 'payid',
    submitted_at: '2026-05-26T09:00:00Z', status: 'Completed',
    reason: 'Auto-approved',
    kyc: 'Verified', account_age_days: 230, prior_withdrawals: 21,
    risk_score: 6,
  },
]

// ── Reconciliation Runs ───────────────────────────────────────────────────────

export const RECON_RUNS = [
  {
    id: 'REC-0215', date: '2026-05-27', provider: 'Stripe Connect',
    total_internal: 38420.50, total_provider: 38384.80,
    variance: 35.70,
    records_total: 1284, matched: 1279, exceptions: 3, missing: 1, ghost: 1,
    status: 'Exception',
    items: [
      { type: 'exception', ref: 'STR-ch_abc123', amount: 28.40, note: 'Timing mismatch — ledger T+0 vs provider T+1' },
      { type: 'exception', ref: 'STR-ch_def456', amount: 5.20,  note: 'Fee discrepancy — expected $0.25, charged $0.47' },
      { type: 'missing',   ref: 'STR-po_ghi789', amount: 80.00, note: 'Payout WD-1041 not in provider feed' },
      { type: 'ghost',     ref: 'STR-ch_jkl012', amount: 2.10,  note: 'Credit in provider feed — no matching internal entry' },
      { type: 'exception', ref: 'STR-re_mno345', amount: 18.40, note: 'Reversal JRN-8770 — provider shows full, internal shows partial' },
    ],
  },
  {
    id: 'REC-0214', date: '2026-05-26', provider: 'Airwallex',
    total_internal: 39180.00, total_provider: 39180.00,
    variance: 0,
    records_total: 84, matched: 84, exceptions: 0, missing: 0, ghost: 0,
    status: 'Matched',
    items: [],
  },
  {
    id: 'REC-0213', date: '2026-05-26', provider: 'Stripe Connect',
    total_internal: 36840.20, total_provider: 36840.20,
    variance: 0,
    records_total: 1198, matched: 1198, exceptions: 0, missing: 0, ghost: 0,
    status: 'Matched',
    items: [],
  },
  {
    id: 'REC-0212', date: '2026-05-25', provider: 'Stripe Connect',
    total_internal: 35210.80, total_provider: 35196.50,
    variance: 14.30,
    records_total: 1142, matched: 1139, exceptions: 2, missing: 1, ghost: 0,
    status: 'Exception',
    items: [
      { type: 'exception', ref: 'STR-ch_pqr678', amount: 12.00, note: 'Duplicate charge — consumer charged twice' },
      { type: 'exception', ref: 'STR-ch_stu901', amount: 2.30,  note: 'Currency rounding mismatch' },
      { type: 'missing',   ref: 'STR-po_vwx234', amount: 45.00, note: 'Payout WD-0984 missing from provider batch' },
    ],
  },
]

// ── Settlement Batches ────────────────────────────────────────────────────────

export const SETTLEMENT_BATCHES = [
  {
    id: 'BTH-0088', created_at: '2026-05-27T10:00:00Z', type: 'Consumer Withdrawal',
    rail: 'payid', count: 142, total_amount: 18420.60,
    status: 'Executing',
    progress_pct: 64,
    rail_fee: 0.00,
    items_completed: 91, items_failed: 2, items_pending: 49,
  },
  {
    id: 'BTH-0087', created_at: '2026-05-27T08:00:00Z', type: 'Operator Settlement',
    rail: 'airwallex', count: 4, total_amount: 32180.00,
    status: 'Approved',
    approved_by: 'Platform Admin',
    approved_at: '2026-05-27T08:45:00Z',
    rail_fee: 48.27,
    items_completed: 0, items_failed: 0, items_pending: 4,
  },
  {
    id: 'BTH-0086', created_at: '2026-05-26T14:00:00Z', type: 'Recycler Payout',
    rail: 'bank', count: 2, total_amount: 43400.00,
    status: 'Completed',
    completed_at: '2026-05-26T17:22:00Z',
    rail_fee: 0.00,
    items_completed: 2, items_failed: 0, items_pending: 0,
  },
  {
    id: 'BTH-0085', created_at: '2026-05-26T08:00:00Z', type: 'Consumer Withdrawal',
    rail: 'payid', count: 318, total_amount: 41820.40,
    status: 'Completed',
    completed_at: '2026-05-26T08:18:00Z',
    rail_fee: 0.00,
    items_completed: 315, items_failed: 3, items_pending: 0,
  },
  {
    id: 'BTH-0084', created_at: '2026-05-25T10:00:00Z', type: 'Consumer Withdrawal',
    rail: 'stripe', count: 28, total_amount: 5840.00,
    status: 'Completed',
    completed_at: '2026-05-25T10:04:00Z',
    rail_fee: 203.82,
    items_completed: 28, items_failed: 0, items_pending: 0,
  },
]

// ── Webhook Events ────────────────────────────────────────────────────────────

export const WEBHOOKS = [
  { id: 'WHK-8801', ts: '2026-05-27T10:42:18Z', provider: 'Stripe',    event: 'payment.captured',   ref: 'JRN-8801', amount: 10.00,    status: 'Delivered' },
  { id: 'WHK-8800', ts: '2026-05-27T10:38:04Z', provider: 'Internal',  event: 'fraud.hold.created', ref: 'JRN-8800', amount: 25.00,    status: 'Delivered' },
  { id: 'WHK-8799', ts: '2026-05-27T09:14:55Z', provider: 'Internal',  event: 'payout.queued',      ref: 'PO-4401',  amount: 420.00,   status: 'Delivered' },
  { id: 'WHK-8798', ts: '2026-05-26T18:00:02Z', provider: 'Internal',  event: 'hold.released',      ref: 'JRN-8798', amount: 12.60,    status: 'Delivered' },
  { id: 'WHK-8796', ts: '2026-05-26T16:30:11Z', provider: 'PayID',     event: 'payout.completed',   ref: 'PO-4395',  amount: 55.20,    status: 'Delivered' },
  { id: 'WHK-8795', ts: '2026-05-26T16:15:42Z', provider: 'PayID',     event: 'payout.completed',   ref: 'WD-1041',  amount: 80.00,    status: 'Delivered' },
  { id: 'WHK-8793', ts: '2026-05-25T14:22:08Z', provider: 'ANZ Bank',  event: 'bank.credit',        ref: 'JRN-8780', amount: 18600.00, status: 'Delivered' },
  { id: 'WHK-8792', ts: '2026-05-25T11:00:33Z', provider: 'ANZ Bank',  event: 'payout.completed',   ref: 'JRN-8790', amount: 24800.00, status: 'Delivered' },
  { id: 'WHK-8790', ts: '2026-05-25T08:14:22Z', provider: 'Stripe',    event: 'dispute.created',    ref: 'STR-dp_001', amount: 18.40,  status: 'Delivered' },
  { id: 'WHK-8785', ts: '2026-05-24T17:41:55Z', provider: 'Airwallex', event: 'payout.completed',   ref: 'JRN-8785', amount: 8420.00,  status: 'Delivered' },
  { id: 'WHK-8782', ts: '2026-05-24T09:00:01Z', provider: 'Internal',  event: 'points.issued',      ref: 'JRN-8782', amount: 6.00,     status: 'Delivered' },
  { id: 'WHK-8780', ts: '2026-05-23T15:12:44Z', provider: 'Internal',  event: 'settlement.created', ref: 'BTH-0086', amount: 43400.00, status: 'Delivered' },
]

// ── Payment Rails ─────────────────────────────────────────────────────────────

export const PAYMENT_RAILS = {
  stripe: {
    name: 'Stripe Connect',
    status: 'Operational',
    balance: 38420.50,
    currency: 'AUD',
    fee: '1.7% + $0.30',
    settlement_time: 'T+2 business days',
    monthly_volume: 284600,
    success_rate: 99.2,
    avg_latency_ms: 820,
    last_webhook: '2026-05-27T10:42:18Z',
    use_for: ['consumer_deposits', 'card_payments'],
    failover: 'airwallex',
  },
  airwallex: {
    name: 'Airwallex',
    status: 'Operational',
    balance: 24180.00,
    currency: 'AUD',
    fee: '0.5% capped at $15',
    settlement_time: 'Same day (if before 3pm)',
    monthly_volume: 96400,
    success_rate: 99.8,
    avg_latency_ms: 340,
    last_webhook: '2026-05-24T17:41:55Z',
    use_for: ['operator_settlements', 'bulk_payouts'],
    failover: 'bank',
  },
  payid: {
    name: 'PayID (NPP)',
    status: 'Operational',
    balance: null,
    currency: 'AUD',
    fee: '$0.00',
    settlement_time: 'Instant (24/7)',
    monthly_volume: 182400,
    success_rate: 99.6,
    avg_latency_ms: 180,
    last_webhook: '2026-05-26T16:15:42Z',
    use_for: ['consumer_withdrawals', 'fast_payouts'],
    failover: 'bank',
  },
  bank: {
    name: 'Bank Transfer (ANZ)',
    status: 'Operational',
    balance: 412850.00,
    currency: 'AUD',
    fee: '$0.00',
    settlement_time: '1–2 business days',
    monthly_volume: 68200,
    success_rate: 100.0,
    avg_latency_ms: null,
    last_webhook: '2026-05-25T14:22:08Z',
    use_for: ['recycler_payouts', 'large_transfers'],
    failover: null,
  },
  crypto: {
    name: 'Crypto (Placeholder)',
    status: 'Disabled',
    note: 'Architecture reserved — not active in this region',
    use_for: [],
    failover: null,
  },
}

// ── Treasury Summary ──────────────────────────────────────────────────────────

export const TREASURY_SUMMARY = {
  // Float position: bank assets vs consumer liabilities
  total_bank_assets: 475450.50,    // MAIN_BANK + STRIPE_BALANCE + AIRWALLEX_BALANCE
  total_consumer_liabilities: 379261.40, // CONSUMER_PENDING + CONSUMER_AVAILABLE + RESERVE_FUND + POINTS_LIABILITY
  float_ratio: 1.254,              // must remain >= 1.0
  float_buffer: 96189.10,          // assets - liabilities (surplus)
  float_status: 'Healthy',         // Healthy / Warning / Critical

  // Liability breakdown
  consumer_pending_total: 48620.80,
  consumer_available_total: 312440.60,
  reserve_fund_total: 18200.00,
  points_liability_total: 24100.00,  // at $0.005/pt
  points_outstanding: 4820000,        // total points across all users

  // Outstanding payables
  operator_payable: 32180.00,
  recycler_payable: 61400.00,

  // Platform
  platform_revenue_mtd: 284600.00,
  payment_fees_mtd: 12840.00,
  net_revenue_mtd: 271760.00,

  // 7-day trend
  days_7d: ['21 May', '22 May', '23 May', '24 May', '25 May', '26 May', '27 May'],
  float_ratio_7d: [1.18, 1.21, 1.24, 1.22, 1.26, 1.25, 1.25],
  revenue_7d:     [38400, 41200, 44800, 40100, 48200, 42800, 38400],
  payout_7d:      [28100, 32400, 38200, 29800, 41600, 36200, 28400],
}
