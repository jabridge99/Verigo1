'use client'

import { apiFetch, storeSession, type AuthUser } from '@/lib/auth'
import { createCustomer } from '@/lib/api/customers'
import {
  listMyOrganisations,
  createOrganisation,
  updateOrganisation,
  setOrganisationIndustry,
  setOrganisationRiskProfile,
  selectIndustry,
  generateAmlProgram,
  generateRiskAssessment,
  listAmlProgramVersions,
  getAmlProgramVersion,
  exportAmlProgram,
  getAmlProgramHealth,
  acknowledgeAmlAccountability,
  type Organisation,
  type AmlProgramItem,
  type AmlProgram,
  type AmlProgramSectionCompletion,
  type AmlProgramDocument,
  type RiskFactor,
  type RiskAssessment,
  type AmlProgramVersion,
  type AmlProgramVersionList,
  type AmlProgramVersionDetail,
  type ProgramHealth,
} from '@/lib/api/organisations'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface RegisterResult {
  user_id: string
  org_id: string
  email: string
  full_name: string
  role: AuthUser['role']
  industry_id?: string
  is_super_admin?: boolean
  access_token: string
  dev_verify_email_token?: string
}

// Organisation, AmlProgramItem, AmlProgram and the rest of the
// organisations-resource types/functions below are re-exported from
// lib/api/organisations.ts (the canonical definitions) to keep this
// module's existing consumers (app/start-trial/StartTrialForm.tsx,
// app/aml-program/page.tsx, components/OnboardingWizard.tsx) compiling
// unchanged.
export type {
  Organisation,
  AmlProgramItem,
  AmlProgram,
  AmlProgramSectionCompletion,
  AmlProgramDocument,
  RiskFactor,
  RiskAssessment,
  AmlProgramVersion,
  AmlProgramVersionList,
  AmlProgramVersionDetail,
  ProgramHealth,
}
export {
  listMyOrganisations,
  createOrganisation,
  updateOrganisation,
  setOrganisationIndustry,
  setOrganisationRiskProfile,
  selectIndustry,
  generateAmlProgram,
  generateRiskAssessment,
  listAmlProgramVersions,
  getAmlProgramVersion,
  exportAmlProgram,
  getAmlProgramHealth,
  acknowledgeAmlAccountability,
}

async function asJson(r: Response) {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Request failed')
  }
  return r.json()
}

export async function registerAccount(opts: {
  email: string
  password: string
  full_name: string
  organisation_name?: string
}): Promise<RegisterResult> {
  const r = await apiFetch(`${API}/api/v1/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  const data: RegisterResult = await asJson(r)
  if (data.access_token) {
    storeSession(
      {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        industry_id: data.industry_id,
        is_super_admin: data.is_super_admin,
      },
      data.access_token,
    )
  }
  return data
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const r = await apiFetch(`${API}/api/v1/auth/email/verify/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  await asJson(r)
}

// The organisation's real AML/CTF Program document (app/api/routes/aml_program.py),
// auto-drafted from the industry template as soon as an industry is selected --
// distinct from the AmlProgram/generateAmlProgram() checklist above, which is a
// separate, versioned deliverable with its own export/QR-verification workflow
// (see web/app/aml-program/page.tsx). This document has no preview/paywall concept.

// Uses /versions (not GET /aml-program, which only returns an *active*
// program) because a freshly-seeded program is still a draft at this point
// in onboarding -- nobody has reviewed/activated it yet. /versions returns
// every version regardless of status, newest first, so the most recent one
// is the org's real, just-seeded program document.
export async function getLatestAmlProgramDocument(): Promise<AmlProgramDocument | null> {
  const r = await apiFetch(`${API}/api/v1/aml-program/versions?page_size=1`, { credentials: 'include' })
  const data = await asJson(r)
  return data.versions?.[0] ?? null
}

/**
 * Downloads the document-controlled export (watermarked for unpaid orgs,
 * 1-year validity stamp, print blocked) and returns it as HTML for the
 * caller to open, e.g. via a Blob URL. See export_aml_program_html on the
 * backend for the document-control policy this implements.
 */
export async function exportAmlProgramHtml(orgId: string, reason: string): Promise<string> {
  const r = await apiFetch(
    `${API}/api/v1/organisations/${orgId}/aml-program/export-html?reason=${encodeURIComponent(reason)}`,
    { credentials: 'include' },
  )
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Export failed')
  }
  return r.text()
}

export interface FirstCustomerInput {
  full_name: string
  date_of_birth: string
  nationality: string
  country_of_residence: string
  id_number: string
  id_type: string
  address: string
  email: string
  phone: string
  industry: 'banking' | 'fintech' | 'insurance' | 'real_estate' | 'cryptocurrency' | 'other'
  occupation?: string
  source_of_funds?: string
}

export async function createFirstCustomer(payload: FirstCustomerInput): Promise<{ customer_id: string; full_name: string }> {
  // The real response is CustomerResponse (id, full_name, ...) — this
  // function's declared shape (customer_id, full_name) predates that and
  // was never actually populated correctly (its one caller doesn't read
  // the result), so map id -> customer_id explicitly instead of trusting
  // the raw response to already match.
  const c = await createCustomer(payload)
  return { customer_id: c.id, full_name: c.full_name }
}
