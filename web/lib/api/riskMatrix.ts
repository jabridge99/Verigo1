// Typed risk-matrix-configuration client — seventeenth pilot for the
// shared lib/api/client.ts pattern. Covers
// app/governance/risk-matrix/page.tsx's /api/v1/risk-matrix/* call
// sites: factor/profile/version listing, factor create/update, and
// restore-to-defaults. The backend route file also has
// GET /factors/{id} (unused), PATCH /profiles/{risk_level} (the page
// only displays profiles, never edits them), DELETE /factors/{id},
// GET /versions/{id}, and GET /export/excel — none called by this
// page, so scope matches what actually exists.
//
// Types mirror app/api/routes/risk_matrix_config.py's _factor_dict/
// _profile_dict and the literal shapes of list_risk_factors/
// list_risk_profiles/list_versions/restore_defaults's return
// statements, and app/schemas/risk_matrix_config.py's
// RiskFactorCreate/RiskFactorUpdate for the two mutation payloads.

import { apiGet, apiPatch, apiPost } from './client'

export type RiskFactorCategory =
  | 'customer' | 'geographic' | 'product' | 'transaction' | 'behaviour'
  | 'crypto' | 'professional_service' | 'delivery_channel' | 'custom'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface RiskFactor {
  id: string
  category: RiskFactorCategory
  factor_key: string
  label: string
  description: string | null
  weight: number
  is_active: boolean
  is_system: boolean
  display_order: number
  updated_by: string | null
  updated_at: string | null
}

export interface RiskProfile {
  id: string
  risk_level: RiskLevel
  score_min: number
  score_max: number
  review_frequency_months: number
  edd_required: boolean
  enhanced_monitoring: boolean
  senior_approval_required: boolean
  description: string | null
  updated_at: string | null
}

export interface RiskMatrixVersion {
  id: string
  version_number: number
  change_type: string
  change_summary: string
  changed_by: string
  change_reason: string | null
  created_at: string
}

export interface RiskFactorsResponse {
  by_category: Record<string, RiskFactor[]>
  weight_totals: Record<string, number>
  disclaimer: string
}

export interface RiskProfilesResponse {
  profiles: RiskProfile[]
  disclaimer: string
}

export interface RestoreDefaultsResult {
  restored: string[]
  category: string
  disclaimer: string
}

export interface AddRiskFactorInput {
  category: RiskFactorCategory
  factor_key: string
  label: string
  description?: string
  weight: number
  display_order?: number
}

export interface UpdateRiskFactorInput {
  weight?: number
  is_active?: boolean
  label?: string
  description?: string
  display_order?: number
}

/** GET /risk-matrix/factors */
export function listRiskFactors(activeOnly = false): Promise<RiskFactorsResponse> {
  return apiGet(`/api/v1/risk-matrix/factors?active_only=${activeOnly}`)
}

/** GET /risk-matrix/profiles */
export function listRiskProfiles(): Promise<RiskProfilesResponse> {
  return apiGet('/api/v1/risk-matrix/profiles')
}

/** GET /risk-matrix/versions */
export function listRiskMatrixVersions(limit?: number): Promise<RiskMatrixVersion[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/risk-matrix/versions${q}`)
}

/** POST /risk-matrix/factors */
export function addRiskFactor(payload: AddRiskFactorInput, reason: string): Promise<RiskFactor> {
  return apiPost(`/api/v1/risk-matrix/factors?reason=${encodeURIComponent(reason)}`, payload)
}

/** PATCH /risk-matrix/factors/{id} */
export function updateRiskFactor(factorId: string, payload: UpdateRiskFactorInput, reason: string): Promise<RiskFactor> {
  return apiPatch(`/api/v1/risk-matrix/factors/${factorId}?reason=${encodeURIComponent(reason)}`, payload)
}

/** POST /risk-matrix/restore-defaults */
export function restoreDefaults(section: string, reason: string): Promise<RestoreDefaultsResult> {
  return apiPost(`/api/v1/risk-matrix/restore-defaults?section=${section}&reason=${encodeURIComponent(reason)}`)
}
