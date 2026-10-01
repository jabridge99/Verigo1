// Typed organisations-resource client — fourth pilot for the shared
// lib/api/client.ts pattern (see customers.ts / analytics.ts / billing.ts
// for the first three). Covers lib/signup.ts's /api/v1/organisations*
// call sites only.
//
// Deliberately out of scope, left on raw apiFetch() in lib/signup.ts:
//  - registerAccount / confirmEmailVerification (/api/v1/auth/*) — a
//    different backend resource (auth.py).
//  - getLatestAmlProgramDocument (/api/v1/aml-program/versions) — this
//    looks similar but is a genuinely separate resource
//    (app/api/routes/aml_program.py, prefix "/aml-program", no org_id in
//    the path), distinct from this file's nested
//    /organisations/{org_id}/aml-program/* routes.
//  - exportAmlProgramHtml — returns raw HTML (HTMLResponse on the
//    backend, r.text() on the frontend), which apiGet/apiPost can't
//    handle since they always parse JSON.
//
// Types mirror app/schemas/organisation.py, widened/renamed only where
// lib/signup.ts's pre-existing local types were already in active use by
// other consumers (app/start-trial/StartTrialForm.tsx, app/aml-program/page.tsx,
// components/OnboardingWizard.tsx) — see lib/signup.ts for the re-exports
// that keep those call sites compiling unchanged.

import { apiGet, apiPatch, apiPost } from './client'

export interface Organisation {
  id: string
  name: string
  industry_type?: string
  industry_id?: string
  risk_profile?: 'low' | 'standard' | 'high'
  abn?: string
  business_address?: string
  phone?: string
  compliance_officer_name?: string
  compliance_officer_email?: string
}

export interface AmlProgramItem {
  category: string
  title: string
  description?: string
  review_frequency?: string
  is_required: boolean
  locked?: boolean
}

export interface AmlProgram {
  program_id: string
  industry_id: string
  risk_profile: string
  status: string
  version: number
  items: AmlProgramItem[]
  is_preview?: boolean
  total_items?: number
}

export interface AmlProgramSectionCompletion {
  sections: Record<string, boolean>
  completed: number
  total: number
  completion_pct: number
}

export interface AmlProgramDocument {
  id: string
  status: string
  version: number
  risk_appetite?: string
  section_completion: AmlProgramSectionCompletion
}

export interface RiskFactor {
  factor: string
  label: string
  description: string
  rating: string
  locked?: boolean
}

export interface RiskAssessment {
  industry_id: string
  risk_profile: string
  overall_rating: string
  factors: RiskFactor[]
  is_preview?: boolean
  total_factors?: number
}

export interface AmlProgramVersion {
  version: number
  generated_at?: string
  item_count: number
  content_hash: string
  qr_token: string
  is_current: boolean
  locked?: boolean
}

export interface AmlProgramVersionList {
  versions: AmlProgramVersion[]
  full_history_available: boolean
}

export interface AmlProgramVersionDetail {
  version: number
  generated_at?: string
  item_count: number
  content_hash: string
  qr_token: string
  items: AmlProgramItem[]
}

export interface ProgramHealth {
  score: number
  up_to_date: boolean
  suggestions: { category: string; title: string; description?: string }[]
}

/** GET /organisations — orgs the current user belongs to. */
export function listMyOrganisations(): Promise<Organisation[]> {
  return apiGet('/api/v1/organisations')
}

/** POST /organisations */
export function createOrganisation(name: string): Promise<Organisation> {
  return apiPost('/api/v1/organisations', { name })
}

/** PATCH /organisations/{org_id} */
export function updateOrganisation(orgId: string, fields: Partial<Organisation>): Promise<Organisation> {
  return apiPatch(`/api/v1/organisations/${orgId}`, fields)
}

export function setOrganisationIndustry(orgId: string, industryId: string): Promise<Organisation> {
  return updateOrganisation(orgId, { industry_id: industryId })
}

export function setOrganisationRiskProfile(
  orgId: string,
  riskProfile: 'low' | 'standard' | 'high'
): Promise<Organisation> {
  return updateOrganisation(orgId, { risk_profile: riskProfile })
}

// Sets the org's real AUSTRAC industry (industry_type) and re-seeds its
// AML/CTF Program + Risk Framework from the matching Compliance Pack --
// distinct from setOrganisationIndustry() above, which only sets the
// unrelated free-text industry_id field. This is what the onboarding
// wizard's "choose your industry" step should call.
export function selectIndustry(orgId: string, industryType: string): Promise<Organisation> {
  return apiPost(`/api/v1/organisations/${orgId}/select-industry`, { industry_type: industryType })
}

/** POST /organisations/{org_id}/aml-program/generate */
export function generateAmlProgram(orgId: string): Promise<AmlProgram> {
  return apiPost(`/api/v1/organisations/${orgId}/aml-program/generate`)
}

/** POST /organisations/{org_id}/risk-assessment/generate */
export function generateRiskAssessment(orgId: string): Promise<RiskAssessment> {
  return apiPost(`/api/v1/organisations/${orgId}/risk-assessment/generate`)
}

// Uses /versions (not GET /aml-program, which only returns an *active*
// program) because a freshly-seeded program is still a draft at this point
// in onboarding -- nobody has reviewed/activated it yet. /versions returns
// every version regardless of status, newest first.
export function listAmlProgramVersions(orgId: string): Promise<AmlProgramVersionList> {
  return apiGet(`/api/v1/organisations/${orgId}/aml-program/versions`)
}

export function getAmlProgramVersion(orgId: string, version: number): Promise<AmlProgramVersionDetail> {
  return apiGet(`/api/v1/organisations/${orgId}/aml-program/versions/${version}`)
}

/** POST /organisations/{org_id}/aml-program/export */
export function exportAmlProgram(orgId: string, reason: string): Promise<void> {
  return apiPost(`/api/v1/organisations/${orgId}/aml-program/export`, { reason })
}

export function getAmlProgramHealth(orgId: string): Promise<ProgramHealth> {
  return apiGet(`/api/v1/organisations/${orgId}/aml-program/health`)
}

/** POST /organisations/{org_id}/aml-accountability/ack */
export function acknowledgeAmlAccountability(orgId: string): Promise<void> {
  return apiPost(`/api/v1/organisations/${orgId}/aml-accountability/ack`, { acknowledged: true })
}
