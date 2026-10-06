// Typed independent-review-resource client — sixteenth pilot for the
// shared lib/api/client.ts pattern. Covers
// app/governance/independent-review/page.tsx's /api/v1/independent-reviews/*
// call sites: review list/dashboard, finding register/workflow, and the
// per-finding recommendations/actions read-only drill-down. The backend
// route file (app/api/routes/independent_review.py) has a much larger
// surface — creating reviews/findings/recommendations/actions, updating
// them, accept-risk, accept/reject/complete recommendation, the action
// lifecycle (start/complete/verify/cancel), enums, and an HTML export —
// none of which this page currently calls (its own "create" tab is
// dead: declared in a Tab union but never rendered), so this pilot's
// scope matches what actually exists, same discipline as `screening`.
//
// Types mirror app/api/routes/independent_review.py's _review_dict/
// _finding_dict/_rec_dict/_action_dict, scoped to the fields the page
// already declared (and reads) in its own pre-existing local
// interfaces — not the full ~25-40 field dicts.

import { apiGet, apiPost } from './client'

export type ReviewStatus = 'planned' | 'in_progress' | 'findings_issued' | 'response_due' | 'completed' | 'archived'
export type FindingRisk = 'low' | 'medium' | 'high' | 'critical'
export type FindingStatus = 'open' | 'response_submitted' | 'in_remediation' | 'closed' | 'overdue' | 'accepted_risk'

export interface Review {
  id: string
  review_ref: string
  review_type: string
  review_scope: string
  status: ReviewStatus
  overall_rating?: string | null
  title: string
  reviewer_name?: string | null
  reviewer_firm?: string | null
  review_period_start?: string | null
  review_period_end?: string | null
  finding_count_critical: number
  finding_count_high: number
  finding_count_medium: number
  finding_count_low: number
  management_response_due?: string | null
  board_acknowledged: boolean
  report_ref?: string | null
}

export interface Finding {
  id: string
  finding_ref: string
  finding_number: number
  title: string
  description: string
  risk_rating: FindingRisk
  category: string
  status: FindingStatus
  regulatory_reference?: string | null
  policy_reference?: string | null
  affected_areas?: string[] | null
  management_response?: string | null
  response_due_date?: string | null
  closed_at?: string | null
  closure_evidence?: string | null
}

export interface Recommendation {
  id: string
  recommendation_ref: string
  description: string
  priority: string
  status: string
  target_date?: string | null
}

export interface ActionItem {
  id: string
  action_ref: string
  title: string
  status: string
  assigned_to?: string | null
  due_date?: string | null
  is_overdue: boolean
  completion_evidence?: string | null
}

export interface Paginated<T> {
  total: number
  items: T[]
}

export interface ReviewDashboard {
  review: { id: string; review_ref: string; status: string; overall_rating?: string | null; board_acknowledged: boolean }
  findings: { total: number; by_risk: Record<string, number>; by_status: Record<string, number>; overdue: Finding[] }
  recommendations: { total: number; open: number; accepted: number; in_progress: number; completed: number; rejected: number; overdue: Recommendation[] }
  actions: { total: number; planned: number; in_progress: number; completed: number; verified: number; overdue: ActionItem[] }
  disclaimer: string
}

export interface OrgDashboard {
  open_findings: number
  open_findings_by_risk: Record<string, number>
  overdue_actions: number
  pending_verification: number
  overdue_action_list: ActionItem[]
  disclaimer: string
}

/** GET /independent-reviews */
export function listReviews(): Promise<Paginated<Review>> {
  return apiGet('/api/v1/independent-reviews')
}

/** GET /independent-reviews/org-dashboard */
export function getOrgDashboard(): Promise<OrgDashboard> {
  return apiGet('/api/v1/independent-reviews/org-dashboard')
}

/** GET /independent-reviews/{id}/dashboard */
export function getReviewDashboard(reviewId: string): Promise<ReviewDashboard> {
  return apiGet(`/api/v1/independent-reviews/${reviewId}/dashboard`)
}

/** GET /independent-reviews/{id}/findings */
export function listFindings(reviewId: string): Promise<Paginated<Finding>> {
  return apiGet(`/api/v1/independent-reviews/${reviewId}/findings`)
}

/** GET /independent-reviews/{reviewId}/findings/{findingId}/recommendations */
export function listRecommendations(reviewId: string, findingId: string): Promise<Paginated<Recommendation>> {
  return apiGet(`/api/v1/independent-reviews/${reviewId}/findings/${findingId}/recommendations`)
}

/** GET /independent-reviews/{reviewId}/findings/{findingId}/recommendations/{recId}/actions */
export function listActions(reviewId: string, findingId: string, recId: string): Promise<Paginated<ActionItem>> {
  return apiGet(`/api/v1/independent-reviews/${reviewId}/findings/${findingId}/recommendations/${recId}/actions`)
}

/** POST /independent-reviews/{reviewId}/findings/{findingId}/submit-response */
export function submitFindingResponse(reviewId: string, findingId: string, managementResponse: string): Promise<Finding> {
  return apiPost(`/api/v1/independent-reviews/${reviewId}/findings/${findingId}/submit-response?management_response=${encodeURIComponent(managementResponse)}`)
}

/** POST /independent-reviews/{reviewId}/findings/{findingId}/start-remediation */
export function startFindingRemediation(reviewId: string, findingId: string): Promise<Finding> {
  return apiPost(`/api/v1/independent-reviews/${reviewId}/findings/${findingId}/start-remediation`)
}

/** POST /independent-reviews/{reviewId}/findings/{findingId}/close */
export function closeFinding(reviewId: string, findingId: string, closureEvidence: string): Promise<Finding> {
  return apiPost(`/api/v1/independent-reviews/${reviewId}/findings/${findingId}/close?closure_evidence=${encodeURIComponent(closureEvidence)}`)
}

/** POST /independent-reviews/{id}/board-acknowledge */
export function boardAcknowledge(reviewId: string): Promise<Review> {
  return apiPost(`/api/v1/independent-reviews/${reviewId}/board-acknowledge`)
}
