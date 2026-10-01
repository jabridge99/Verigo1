// Typed case-management client — thirtieth pilot for the shared
// lib/api/client.ts pattern. Covers app/mlro/page.tsx's 5
// /api/v1/cases* call sites: list, get-by-id, status transition,
// close, linked alerts, and create. The route file also has
// /assign, /escalate, /notes, /evidence, /link-alert, /smr/consider,
// /smr/lodge, and /dashboard — none called by this page, so scope
// matched what actually exists.
//
// Types mirror app/schemas/case.py's CaseOut/CaseListOut and
// app/schemas/monitoring.py's AlertOut.

import { apiGet, apiPost } from './client'

export type CaseType =
  | 'smr_candidate' | 'internal_investigation' | 'edd_review' | 'regulatory_inquiry'
  | 'law_enforcement_request' | 'customer_exit' | 'tipping_off_risk' | 'periodic_review' | 'other'

export type CaseStatus =
  | 'open' | 'under_investigation' | 'additional_information' | 'escalated' | 'decision'
  | 'closed_no_action' | 'closed_smr_filed' | 'closed_referred' | 'closed_exited' | 'closed_no_smr'

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical'

export type CaseOutcome =
  | 'no_suspicious_activity' | 'smr_filed' | 'referred_law_enforcement' | 'customer_exited'
  | 'controls_enhanced' | 'edd_completed' | 'no_action_required' | 'other'

/** GET /cases -- mirrors CaseListOut, a slim list shape. Notably has
 * no `description`, `outcome`, `outcome_notes`, `closure_reason`, or
 * `alert_ids` -- those exist only on the full `Case`/`CaseOut` detail
 * shape (or, for linked alerts, the separate GET /cases/{id}/alerts
 * response), confirmed live. A detail view must fetch GET /cases/{id}
 * rather than reusing a list row. `closed_at` was missing here too
 * (the page's "Closed this week" stat always read undefined off every
 * list row and so always showed 0) -- added to CaseListOut in the same
 * pass since the ORM already loads the column, no query change needed. */
export interface CaseListItem {
  id: string
  case_ref: string
  customer_id?: string | null
  case_type: CaseType
  severity: CaseSeverity
  status: CaseStatus
  title: string
  is_smr_candidate: boolean
  is_overdue: boolean
  assigned_to?: string | null
  due_date?: string | null
  closed_at?: string | null
  created_at: string
}

/** GET /cases/{id}, POST .../status, POST .../close -- mirrors CaseOut. */
export interface Case {
  id: string
  case_ref: string
  org_id: string
  customer_id?: string | null
  case_type: CaseType
  severity: CaseSeverity
  status: CaseStatus
  title: string
  description?: string | null
  assigned_to?: string | null
  assigned_at?: string | null
  escalated_to?: string | null
  escalated_at?: string | null
  escalation_reason?: string | null
  due_date?: string | null
  is_overdue: boolean
  is_smr_candidate: boolean
  smr_considered: boolean
  smr_considered_by?: string | null
  smr_considered_at?: string | null
  smr_lodged: boolean
  smr_lodged_at?: string | null
  smr_lodged_by?: string | null
  smr_reference?: string | null
  tipping_off_risk: boolean
  linked_customer_ids: string[]
  related_case_ids: string[]
  outcome?: CaseOutcome | null
  outcome_notes?: string | null
  closed_by?: string | null
  closed_at?: string | null
  closure_reason?: string | null
  created_by: string
  created_at: string
  updated_at?: string | null
}

/** GET /cases/{id}/alerts -- mirrors AlertOut. This page only reads a
 * handful of fields; the rest are included for an accurate mirror. */
export interface LinkedAlert {
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
}

/** POST /cases -- mirrors CaseCreate. `assigned_to`/`created_by` are
 * deliberately absent: CaseCreate has no such fields (pydantic silently
 * drops unknown keys rather than rejecting them), confirmed live --
 * `created_by` is always the authenticated user server-side, and
 * assignment only happens via the separate POST /cases/{id}/assign. */
export interface CaseCreateInput {
  customer_id?: string
  case_type?: CaseType
  severity?: CaseSeverity
  title: string
  description?: string
  due_date?: string
  is_smr_candidate?: boolean
  linked_customer_ids?: string[]
  related_case_ids?: string[]
  alert_ids?: string[]
}

/** GET /cases?page_size=... Defaults to the API's max (200) -- the bare
 * endpoint defaults to page_size=25 server-side, which this page's old
 * (nonexistent) `?limit=100` query param never overrode, so the case
 * queue silently showed only the first 25 cases with no pagination UI
 * to recover the rest, confirmed live. */
export function listCases(pageSize = 200): Promise<CaseListItem[]> {
  return apiGet(`/api/v1/cases?page=1&page_size=${pageSize}`)
}

/** GET /cases/{id} */
export function getCase(caseId: string): Promise<Case> {
  return apiGet(`/api/v1/cases/${caseId}`)
}

/** GET /cases/{id}/alerts */
export function getCaseAlerts(caseId: string): Promise<LinkedAlert[]> {
  return apiGet(`/api/v1/cases/${caseId}/alerts`)
}

/** POST /cases */
export function createCase(payload: CaseCreateInput): Promise<Case> {
  return apiPost('/api/v1/cases', payload)
}

/** POST /cases/{id}/status */
export function transitionCaseStatus(caseId: string, newStatus: CaseStatus, reason?: string): Promise<Case> {
  return apiPost(`/api/v1/cases/${caseId}/status`, { new_status: newStatus, reason })
}

export interface CaseCloseInput {
  status: CaseStatus
  outcome: CaseOutcome
  outcome_notes?: string
  closure_reason: string
}

/** POST /cases/{id}/close */
export function closeCase(caseId: string, payload: CaseCloseInput): Promise<Case> {
  return apiPost(`/api/v1/cases/${caseId}/close`, payload)
}
