// Typed reports-resource client — twelfth pilot for the shared
// lib/api/client.ts pattern. Covers the /api/v1/reports/* call sites in
// app/reporting/page.tsx (ttr/smr/summary + their review/approve/submit/
// acknowledge workflow) and app/ecdd/page.tsx (list/create/decide).
//
// Deliberately excludes /api/v1/ifti/* — app/reporting/page.tsx also
// calls that, but it's a genuinely separate resource (app/api/routes/
// ifti.py, its own router/prefix, not part of the app/api/routes/reports/
// package) despite sharing the same page and the same generic
// review/approve/submit/acknowledge workflow shape. Left on raw
// apiFetch()/API in the page.
//
// Types mirror app/api/routes/reports/ttr.py's _ttr_dict, .../smr.py's
// _smr_dict (scoped to the fields app/reporting/page.tsx's mapReport()
// actually reads — the real dict has ~60 AUSTRAC SMR-form fields),
// .../summary.py's reporting_summary() shape, and
// app/schemas/report.py's ECDDCreate/ECDDResponse/ECDDDecisionRequest.

import { apiGet, apiPatch, apiPost } from './client'

export interface TtrReport {
  id: string
  report_ref: string
  status?: string | null
  priority?: string | null
  customer_id?: string | null
  transaction_id?: string | null
  transaction_date?: string | null
  total_amount?: number | null
  currency?: string | null
  transaction_type?: string | null
  due_date?: string | null
  prepared_by?: string | null
  reviewed_by?: string | null
  approved_by?: string | null
  submitted_by?: string | null
  submitted_at?: string | null
  acknowledged_at?: string | null
  created_at?: string | null
}

export interface SmrReport {
  id: string
  report_ref: string
  status?: string | null
  priority?: string | null
  customer_id?: string | null
  case_id?: string | null
  subject_name?: string | null
  suspicion_grounds?: string | null
  narrative?: string | null
  total_amount?: number | null
  grand_total?: number | null
  transaction_ids?: string[] | null
  due_date?: string | null
  prepared_by?: string | null
  reviewed_by?: string | null
  approved_by?: string | null
  mlro_sign_off?: string | null
  submission_reference?: string | null
  created_at?: string | null
  submitted_at?: string | null
  acknowledged_at?: string | null
}

export interface ReportingSummary {
  total: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  overdue: number
  due_soon: number
  submitted: number
  draft: number
  under_review: number
  total_filed: number
}

/** GET /reports/ttr */
export function listTtrReports(limit?: number): Promise<TtrReport[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/reports/ttr${q}`)
}

/** GET /reports/smr */
export function listSmrReports(limit?: number): Promise<SmrReport[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/reports/smr${q}`)
}

/** GET /reports/summary */
export function getReportingSummary(): Promise<ReportingSummary> {
  return apiGet('/api/v1/reports/summary')
}

// The workflow actions below (review/approve/submit/acknowledge) return a
// small ad-hoc {report_id, status} dict, not the full TtrReport/SmrReport —
// confirmed against app/api/routes/reports/ttr.py's and smr.py's actual
// return statements. The page ignores the response body on success (it
// applies its own optimistic status update), but the type should still
// reflect what the backend really sends back.
export interface ReportWorkflowResult {
  report_id: string
  status: string
  mlro_sign_off?: string | null
  disclaimer?: string
}

/** POST /reports/{type}/{id}/review */
export function reviewReport(reportType: 'ttr' | 'smr', reportId: string): Promise<ReportWorkflowResult> {
  return apiPost(`/api/v1/reports/${reportType}/${reportId}/review`)
}

/** POST /reports/ttr/{id}/approve or /reports/smr/{id}/mlro-sign-off */
export function approveReport(reportType: 'ttr' | 'smr', reportId: string): Promise<ReportWorkflowResult> {
  const action = reportType === 'smr' ? 'mlro-sign-off' : 'approve'
  return apiPost(`/api/v1/reports/${reportType}/${reportId}/${action}`)
}

/** POST /reports/{type}/{id}/submit */
export function submitReport(reportType: 'ttr' | 'smr', reportId: string, submissionReference: string): Promise<ReportWorkflowResult> {
  return apiPost(`/api/v1/reports/${reportType}/${reportId}/submit?submission_reference=${encodeURIComponent(submissionReference)}`)
}

/** POST /reports/{type}/{id}/acknowledge */
export function acknowledgeReport(reportType: 'ttr' | 'smr', reportId: string, acknowledgementRef: string): Promise<ReportWorkflowResult> {
  return apiPost(`/api/v1/reports/${reportType}/${reportId}/acknowledge?acknowledgement_ref=${encodeURIComponent(acknowledgementRef)}`)
}

export interface ECDDRecord {
  id: string
  ecdd_id: string
  customer_id: string
  trigger_reason: string
  trigger_reason_other?: string | null
  pep_status: number
  adverse_media_found: number
  beneficial_owner_verified: number
  source_of_wealth_verified: number
  source_of_funds?: string | null
  source_of_wealth_notes?: string | null
  purpose_of_transaction?: string | null
  high_tax_risk?: number
  tax_risk_notes?: string | null
  investment_legitimacy_notes?: string | null
  enhanced_risk_score: number
  recommendation?: string | null
  analyst_notes?: string | null
  status: string
  rejection_type?: string | null
  decision_notes?: string | null
  decided_by?: string | null
  decided_at?: string | null
  last_revised_at?: string | null
  created_at?: string | null
}

export interface ECDDCreateInput {
  customer_id: string
  trigger_reason: string
  trigger_reason_other?: string
  pep_status?: number
  adverse_media_found?: number
  adverse_media_details?: string
  beneficial_owner_verified?: number
  beneficial_owner_details?: string
  source_of_wealth_verified?: number
  source_of_wealth_details?: string
  source_of_funds?: string
  source_of_wealth_notes?: string
  purpose_of_transaction?: string
  high_tax_risk?: number
  tax_risk_notes?: string
  investment_legitimacy_notes?: string
  analyst_notes?: string
}

export interface ECDDDecisionInput {
  status: string // pending | completed | rejected — a plain str field on the backend, not an enum
  decision_notes: string
  rejection_type?: string
}

/** GET /reports/ecdd/ */
export function listEcddRecords(): Promise<ECDDRecord[]> {
  return apiGet('/api/v1/reports/ecdd/')
}

/** POST /reports/ecdd/ */
export function createEcddRecord(payload: ECDDCreateInput): Promise<ECDDRecord> {
  return apiPost('/api/v1/reports/ecdd/', payload)
}

/** PATCH /reports/ecdd/{id}/decision */
export function decideEcddRecord(ecddId: string, payload: ECDDDecisionInput): Promise<ECDDRecord> {
  return apiPatch(`/api/v1/reports/ecdd/${ecddId}/decision`, payload)
}
