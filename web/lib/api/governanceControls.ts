// Typed governance/controls-resource client — eighth pilot for the shared
// lib/api/client.ts pattern, and the third and last of governance's three
// sub-resources (training/policies/controls — each its own pilot).
// Covers app/governance/controls/page.tsx's /api/v1/governance/controls*
// call sites — the backend route file also has findings/remediations/
// evidence/open-remediations endpoints this page never calls, so they're
// not represented here.
//
// Types mirror app/schemas/governance.py's ControlResponse/
// ControlTestResponse/ControlCreate/ControlTestCreate, scoped to the
// fields this page renders.

import { apiGet, apiPost } from './client'

export type RiskArea =
  | 'cdd' | 'edd' | 'pep_screening' | 'sanctions_screening' | 'transaction_monitoring'
  | 'ifti_reporting' | 'smr_reporting' | 'ttr_reporting' | 'travel_rule'
  | 'record_keeping' | 'training' | 'governance' | 'beneficial_ownership'
  | 'outsourcing' | 'custom'

export type ControlStatus = 'active' | 'inactive' | 'under_review' | 'remediation' | 'suspended'
export type Effectiveness = 'effective' | 'largely_effective' | 'partially_effective' | 'ineffective' | 'not_tested'
export type Frequency =
  | 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annual'
  | 'annual' | 'ad_hoc' | 'per_transaction'

export interface Control {
  id: string
  control_ref: string
  name: string
  description?: string | null
  control_type: string
  risk_area: RiskArea
  control_owner: string
  business_unit?: string | null
  frequency: Frequency
  is_key_control: boolean
  status: ControlStatus
  effectiveness: Effectiveness
  last_tested_date?: string | null
  next_test_date?: string | null
}

export interface ControlTest {
  id: string
  control_id: string
  test_date: string
  tester_id: string
  sample_size: number
  passed_samples?: number | null
  failed_samples?: number | null
  result: string
  calculated_effectiveness?: Effectiveness | null
  effectiveness_score?: number | null
  findings_summary?: string | null
  action_required: boolean
  retest_required: boolean
  retest_date?: string | null
  is_finalised: boolean
  created_at?: string | null
}

export interface ControlTestInput {
  test_date: string
  sample_size: number
  passed_samples: number
  failed_samples: number
  result: 'pass' | 'fail'
}

export interface ControlCreateInput {
  name: string
  description?: string
  control_type: string
  risk_area: RiskArea
  control_owner: string
  business_unit?: string
  frequency: Frequency
  control_method: string
  is_key_control: boolean
  next_test_date?: string
}

/** GET /governance/controls */
export function listControls(): Promise<Control[]> {
  return apiGet('/api/v1/governance/controls')
}

/** GET /governance/controls/{id}/tests */
export function listControlTests(controlId: string): Promise<ControlTest[]> {
  return apiGet(`/api/v1/governance/controls/${controlId}/tests`)
}

/** POST /governance/controls/{id}/tests */
export function recordControlTest(controlId: string, payload: ControlTestInput): Promise<ControlTest> {
  return apiPost(`/api/v1/governance/controls/${controlId}/tests`, payload)
}

/** POST /governance/controls */
export function createControl(payload: ControlCreateInput): Promise<Control> {
  return apiPost('/api/v1/governance/controls', payload)
}
