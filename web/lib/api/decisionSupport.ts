// Typed decision-support client — twenty-first pilot for the shared
// lib/api/client.ts pattern. Covers app/decision-support/page.tsx's
// 5 /api/v1/rule-builder/decision-support* call sites: list, create,
// get (single panel refetch), submit review, workflow history. Shares
// its backend router file with Rule Builder (app/rule-builder/page.tsx,
// migrated last pass) but is a genuinely separate sub-resource with its
// own models (DecisionSupportPanel, ApprovalWorkflowStep) — not
// migrated there.
//
// Types mirror app/api/routes/rule_builder.py's _panel_dict() and the
// literal return shapes of submit_review_step()/workflow_history().

import { apiGet, apiPost } from './client'

export type StepType = 'analyst_review' | 'compliance_review' | 'mlro_review' | 'senior_approval'
export type DecisionType = 'approved' | 'rejected' | 'more_information' | 'escalated'

export interface RiskSummary {
  customer_risk_score?: number | null
  customer_risk_level?: string | null
  transaction_risk_score?: number | null
  geographic_risk_score?: number | null
  product_risk_score?: number | null
  behaviour_risk_score?: number | null
  risk_matrix_score?: number | null
  alert_score?: number | null
  final_approval_score?: number | null
}

export interface ReportingObligations {
  potential_ttr?: boolean | null
  potential_ifti?: boolean | null
  potential_smr?: boolean | null
  rationale: Record<string, string>
}

export interface PanelWorkflow {
  current_step?: StepType | null
  is_complete: boolean
  final_decision?: DecisionType | null
  final_decision_by?: string | null
  final_decision_at?: string | null
  final_decision_notes?: string | null
}

/** GET/POST /decision-support[/{id}] — the full panel, mirrors _panel_dict(). */
export interface Panel {
  id: string
  org_id: string
  transaction_id?: string | null
  case_id?: string | null
  customer_id: string
  risk_summary: RiskSummary
  triggered_rules: { rule_id: string }[]
  required_actions: { text: string; regulatory_basis?: string }[]
  recommended_actions: { text: string; regulatory_basis?: string }[]
  reporting_obligations: ReportingObligations
  outstanding_tasks: unknown[]
  missing_documents: unknown[]
  workflow: PanelWorkflow
  generated_by?: string | null
  generated_at: string
  disclaimer: string
}

export interface WorkflowStep {
  id: string
  step_type: StepType
  step_order: number
  decision: DecisionType
  reviewer_id?: string | null
  review_notes: string
  conditions: string[]
  risk_snapshot?: Record<string, unknown> | null
  reviewed_at: string
}

/** POST /decision-support/{id}/review's response — a small ad-hoc status
 * dict, NOT the full panel (same "workflow-action returns a small dict"
 * shape as ttr/smr in reports.ts). The page already re-fetches the full
 * Panel via getDecisionPanel() after this, rather than trusting this body. */
export interface ReviewResult {
  panel_id: string
  step_recorded: string
  decision: string
  is_complete: boolean
  current_step: string | null
  final_decision: string | null
  disclaimer: string
}

export interface ReviewInput {
  decision: DecisionType
  review_notes: string
  conditions: string[]
}

export interface ListPanelsFilters {
  customer_id?: string
  transaction_id?: string
  is_complete?: boolean
}

/** GET /rule-builder/decision-support */
export function listDecisionPanels(filters: ListPanelsFilters = {}): Promise<Panel[]> {
  const params = new URLSearchParams()
  if (filters.customer_id) params.set('customer_id', filters.customer_id)
  if (filters.transaction_id) params.set('transaction_id', filters.transaction_id)
  if (filters.is_complete !== undefined) params.set('is_complete', String(filters.is_complete))
  const qs = params.toString()
  return apiGet(`/api/v1/rule-builder/decision-support${qs ? `?${qs}` : ''}`)
}

/** GET /rule-builder/decision-support/{id} */
export function getDecisionPanel(panelId: string): Promise<Panel> {
  return apiGet(`/api/v1/rule-builder/decision-support/${panelId}`)
}

export interface CreatePanelInput {
  customer_id: string
  transaction_id?: string
  case_id?: string
}

/** POST /rule-builder/decision-support?customer_id=...&transaction_id=...&case_id=... */
export function createDecisionPanel(input: CreatePanelInput): Promise<Panel> {
  const params = new URLSearchParams({ customer_id: input.customer_id })
  if (input.transaction_id) params.set('transaction_id', input.transaction_id)
  if (input.case_id) params.set('case_id', input.case_id)
  return apiPost(`/api/v1/rule-builder/decision-support?${params.toString()}`)
}

/** POST /rule-builder/decision-support/{id}/review?step_type=... */
export function submitReviewStep(
  panelId: string,
  stepType: StepType,
  payload: ReviewInput
): Promise<ReviewResult> {
  return apiPost(
    `/api/v1/rule-builder/decision-support/${panelId}/review?step_type=${stepType}`,
    payload
  )
}

/** GET /rule-builder/decision-support/{id}/workflow-history */
export function getWorkflowHistory(panelId: string): Promise<WorkflowStep[]> {
  return apiGet(`/api/v1/rule-builder/decision-support/${panelId}/workflow-history`)
}
