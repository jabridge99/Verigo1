// Typed alerts-resource client — tenth pilot for the shared
// lib/api/client.ts pattern. Covers app/monitoring/page.tsx's
// /api/v1/alerts* call sites only — that page also calls
// /api/v1/transactions/* (a separate resource, left for its own pilot)
// and app/api/routes/alerts.py's own surface has more endpoints
// (assign, flag-smr, record-result, recommendations) the page never
// calls, so they're not represented here either.
//
// Distinct from app/api/routes/screening/alerts.py's ScreeningAlert
// resource (mounted under /screening/alerts) despite the similar name —
// this is TransactionAlert, under the bare /alerts prefix.
//
// Types mirror app/schemas/monitoring.py's AlertListOut/AlertOut and
// app/api/routes/alerts.py's dashboard/create-case response dicts.

import { apiGet, apiPost } from './client'

export interface AlertListItem {
  id: string
  alert_ref: string
  customer_id: string
  category: string
  severity: string
  status: string
  result: string
  alert_score: number
  title: string
  is_smr_candidate: boolean
  assigned_to?: string | null
  trigger_date: string
}

export interface AlertDetail {
  id: string
  alert_ref: string
  org_id: string
  transaction_id: string
  customer_id: string
  alert_type: string
  category: string
  severity: string
  status: string
  rule_id?: string | null
  rule_name?: string | null
  rules_matched: string[]
  alert_score: number
  score_breakdown: Record<string, unknown>
  title: string
  description?: string | null
  behaviour_signals: Record<string, unknown>
  assigned_to?: string | null
  assigned_at?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  escalated_to?: string | null
  escalated_at?: string | null
  escalation_reason?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  resolution?: string | null
  resolution_notes?: string | null
  is_false_positive: boolean
  is_smr_candidate: boolean
  result: string
  result_notes?: string | null
  result_set_by?: string | null
  result_set_at?: string | null
  trigger_date: string
  created_at: string
}

export interface AlertDashboard {
  total_alerts: number
  open_alerts: number
  smr_candidates: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  disclaimer: string
}

export interface ReviewAlertInput {
  resolution: 'dismissed' | 'escalated_to_case' | 'smr_candidate' | 'cleared'
  review_notes?: string
  is_false_positive?: boolean
  is_smr_candidate?: boolean
}

export interface EscalateAlertInput {
  escalate_to: string
  escalation_reason: string
}

export interface CreateCaseFromAlertResponse {
  case_id: string
  case_ref: string
  alert_id: string
  status: string
  message: string
  disclaimer: string
}

/** GET /alerts */
export function listAlerts(limit?: number): Promise<AlertListItem[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/alerts${q}`)
}

/** GET /alerts/dashboard */
export function getAlertDashboard(): Promise<AlertDashboard> {
  return apiGet('/api/v1/alerts/dashboard')
}

/** POST /alerts/{id}/review */
export function reviewAlert(alertId: string, payload: ReviewAlertInput): Promise<AlertDetail> {
  return apiPost(`/api/v1/alerts/${alertId}/review`, payload)
}

/** POST /alerts/{id}/escalate */
export function escalateAlert(alertId: string, payload: EscalateAlertInput): Promise<AlertDetail> {
  return apiPost(`/api/v1/alerts/${alertId}/escalate`, payload)
}

/** POST /alerts/{id}/create-case — convenience endpoint, opens a compliance case pre-linked to the alert. */
export function createCaseFromAlert(alertId: string): Promise<CreateCaseFromAlertResponse> {
  return apiPost(`/api/v1/alerts/${alertId}/create-case`)
}
