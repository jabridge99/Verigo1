// Typed board & executive reporting client — thirty-fourth pilot for
// the shared lib/api/client.ts pattern. Covers app/governance/board-
// reports/page.tsx's 3 call-site functions (fetchReports, createReport,
// and a generic transition() covering 4 lifecycle actions) against
// /api/v1/board-reports*: list, create, submit-for-review, approve,
// distribute, archive. The route file also has GET /enums, GET/PATCH
// /{id}, POST /{id}/regenerate-snapshot, POST /{id}/return-to-draft,
// POST /{id}/new-version, and the export-html/export-csv links (which
// stay plain <a href> browser navigations, matching the
// examination-packs precedent) -- none called by this page, so scope
// matched what actually exists.
//
// Types mirror app/api/routes/board_reporting.py's _report_dict()
// literal return (list/create/every transition all return this same
// shape -- create additionally includes snapshot_data, which this page
// never reads, so it's left out of the type).
//
// submit-for-review's `notes` and approve's `approval_notes` are plain
// (non-Body) FastAPI parameters, so they're read as query params, not a
// JSON body -- unlike the page's old generic transition() helper, which
// only ever sent a JSON body and never actually passed notes for either
// action (no UI input exists for them), so this was a latent mismatch
// with no live effect, not a bug the app has hit. Modelled correctly
// here (as optional query params) rather than carrying the mismatch
// forward into the typed client.

import { apiGet, apiPost } from './client'

export type ReportType = 'board_aml' | 'quarterly_compliance' | 'risk_committee' | 'annual_aml'
export type ReportStatus = 'draft' | 'under_review' | 'approved' | 'distributed' | 'archived'
export type ReportPeriod = 'q1' | 'q2' | 'q3' | 'q4' | 'h1' | 'h2' | 'annual' | 'custom'

/** GET /board-reports, POST /board-reports, and every lifecycle
 * transition -- mirrors _report_dict(include_snapshot=False). */
export interface BoardReport {
  id: string
  report_ref: string
  org_id: string
  report_type: ReportType
  status: ReportStatus
  period: ReportPeriod
  period_start: string
  period_end: string
  report_year: number
  title: string
  executive_summary?: string | null
  mlro_commentary?: string | null
  key_messages?: string[] | null
  generated_at?: string | null
  generated_by?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  approved_by?: string | null
  approved_at?: string | null
  approval_notes?: string | null
  distributed_to?: string[] | null
  distributed_at?: string | null
  distributed_by?: string | null
  distribution_notes?: string | null
  board_minutes_ref?: string | null
  board_resolution?: string | null
  is_confidential: boolean
  version: number
  supersedes_id?: string | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** GET /board-reports */
export interface ListBoardReportsResponse {
  total: number
  items: BoardReport[]
}

export interface BoardReportCreateInput {
  report_ref: string
  report_type: ReportType
  period: ReportPeriod
  period_start: string
  period_end: string
  title?: string
  executive_summary?: string
  mlro_commentary?: string
  key_messages?: string[]
}

export interface DistributeInput {
  distributed_to: string[]
  distribution_notes?: string
}

/** GET /board-reports[?report_type=...&status=...&year=...] */
export function listBoardReports(): Promise<ListBoardReportsResponse> {
  return apiGet('/api/v1/board-reports')
}

/** POST /board-reports */
export function createBoardReport(payload: BoardReportCreateInput): Promise<BoardReport> {
  return apiPost('/api/v1/board-reports', payload)
}

/** POST /board-reports/{id}/submit-for-review?notes=... */
export function submitReportForReview(reportId: string, notes?: string): Promise<BoardReport> {
  const q = notes ? `?notes=${encodeURIComponent(notes)}` : ''
  return apiPost(`/api/v1/board-reports/${reportId}/submit-for-review${q}`)
}

/** POST /board-reports/{id}/approve?approval_notes=... */
export function approveBoardReport(reportId: string, approvalNotes?: string): Promise<BoardReport> {
  const q = approvalNotes ? `?approval_notes=${encodeURIComponent(approvalNotes)}` : ''
  return apiPost(`/api/v1/board-reports/${reportId}/approve${q}`)
}

/** POST /board-reports/{id}/distribute */
export function distributeBoardReport(reportId: string, payload: DistributeInput): Promise<BoardReport> {
  return apiPost(`/api/v1/board-reports/${reportId}/distribute`, payload)
}

/** POST /board-reports/{id}/archive */
export function archiveBoardReport(reportId: string): Promise<BoardReport> {
  return apiPost(`/api/v1/board-reports/${reportId}/archive`)
}
