// Typed governance/policies-resource client — seventh pilot for the shared
// lib/api/client.ts pattern, and the second of governance's three
// sub-resources (training/policies/controls — each a separate pilot).
// Covers app/governance/policies/page.tsx's /api/v1/governance/policies*
// call sites.
//
// Deliberately left as a plain URL (not a fetch function): the PDF/HTML
// export is a window.open() browser navigation, not a fetch call site,
// and returns print-ready HTML (not JSON) — see policyExportHtmlUrl().
//
// Types mirror app/schemas/governance.py's PolicyResponse/
// PolicyVersionResponse/PolicyCreate.

import { apiGet, apiPost, API_BASE } from './client'

export type PolicyType =
  | 'aml_ctf_program' | 'risk_assessment_methodology' | 'cdd_policy' | 'edd_policy'
  | 'pep_policy' | 'beneficial_ownership_policy' | 'transaction_monitoring_policy'
  | 'sanctions_screening_policy' | 'travel_rule_policy' | 'reporting_policy'
  | 'record_keeping_policy' | 'independent_review_policy' | 'training_policy'
  | 'outsourcing_policy' | 'whistleblower_policy' | 'conflict_of_interest_policy'
  | 'data_privacy_policy' | 'procedure' | 'other'

export type PolicyStatus =
  | 'draft' | 'internal_review' | 'compliance_review' | 'pending_approval'
  | 'published' | 'periodic_review' | 'superseded' | 'archived'

export interface Policy {
  id: string
  policy_number: string
  title: string
  policy_type: PolicyType
  status: PolicyStatus
  version_major: number
  version_minor: number
  effective_date?: string | null
  review_due_date: string
  approval_date?: string | null
  document_owner?: string | null
  compliance_reviewer?: string | null
  approver?: string | null
  summary?: string | null
  content?: string | null
  regulatory_references?: string[] | null
  created_at?: string | null
}

export interface PolicyVersion {
  id: string
  policy_id: string
  version_label?: string | null
  version_major: number
  version_minor: number
  title: string
  content?: string | null
  change_type?: string | null
  change_summary?: string | null
  approved_by?: string | null
  approved_at?: string | null
  effective_date?: string | null
  created_by: string
  created_at: string
}

export interface PolicyCreateInput {
  title: string
  policy_type: PolicyType
  summary?: string
  scope?: string
  content?: string
  review_due_date: string
  document_owner: string
  regulatory_references: string[]
}

/** GET /governance/policies */
export function listPolicies(): Promise<Policy[]> {
  return apiGet('/api/v1/governance/policies')
}

/** GET /governance/policies/{id}/versions */
export function listPolicyVersions(policyId: string): Promise<PolicyVersion[]> {
  return apiGet(`/api/v1/governance/policies/${policyId}/versions`)
}

/** POST /governance/policies/{id}/workflow */
export function runPolicyWorkflowAction(policyId: string, action: string): Promise<Policy> {
  return apiPost(`/api/v1/governance/policies/${policyId}/workflow`, { action })
}

/** POST /governance/policies */
export function createPolicy(payload: PolicyCreateInput): Promise<Policy> {
  return apiPost('/api/v1/governance/policies', payload)
}

/** GET /governance/policies/{id}/export-html — print-ready HTML, not JSON. */
export function policyExportHtmlUrl(policyId: string): string {
  return `${API_BASE}/api/v1/governance/policies/${policyId}/export-html`
}
