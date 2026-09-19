// Typed transactions-resource client — eleventh pilot for the shared
// lib/api/client.ts pattern. Covers app/monitoring/page.tsx's 2
// /api/v1/transactions* call sites only — that page's other 5 call
// sites hit /api/v1/alerts/*, a separate resource migrated in the
// prior pilot (lib/api/alerts.ts). The backend's transactions route
// file has a much larger surface (receipt, summary, recommendations,
// approval-checklist, live-panel, draft-report-prefill, questionnaire)
// the page never calls, so it's not represented here.
//
// Types mirror app/schemas/transaction.py's TransactionCreate/
// TransactionOut, scoped to the fields this page's manual
// transaction-entry form actually sends/reads.

import { apiPost } from './client'

export interface CreateTransactionInput {
  transaction_ref: string
  customer_id: string
  transaction_type: string
  direction: 'incoming' | 'outgoing' | 'internal'
  payment_method: string
  currency: string
  amount: number
  is_cross_border: boolean
  country_destination?: string
  purpose?: string
  reference?: string
  description?: string
  transaction_date: string
}

export interface Transaction {
  id: string
  transaction_ref: string
  org_id: string
  customer_id: string
  transaction_type: string
  direction: string
  payment_method: string
  status: string
  currency: string
  amount: number
  amount_aud?: number | null
  purpose?: string | null
  description?: string | null
  reference?: string | null
  is_cross_border: boolean
  counterparty_name?: string | null
  is_near_threshold: boolean
  is_round_number: boolean
  is_structuring_suspect: boolean
  is_cash_intensive: boolean
  risk_score: number
  behaviour_score: number
  geo_risk_score: number
  alerts_generated: number
  rules_matched: string[]
  behaviour_signals: Record<string, unknown>
  transaction_date: string
  created_at: string
}

export interface RunMonitoringResult {
  transaction_id: string
  alerts_generated: number
  alert_ids: string[]
  disclaimer: string
}

/** POST /transactions */
export function createTransaction(payload: CreateTransactionInput): Promise<Transaction> {
  return apiPost('/api/v1/transactions', payload)
}

/** POST /transactions/{id}/run-monitoring */
export function runMonitoringOnTransaction(txnId: string): Promise<RunMonitoringResult> {
  return apiPost(`/api/v1/transactions/${txnId}/run-monitoring`)
}
