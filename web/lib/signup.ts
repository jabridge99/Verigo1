'use client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface RegisterResult {
  user_id: string
  email: string
  full_name: string
  dev_verify_email_token?: string
}

export interface Organisation {
  org_id: string
  name: string
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
}

export interface AmlProgram {
  program_id: string
  industry_id: string
  risk_profile: string
  status: string
  version: number
  items: AmlProgramItem[]
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
}): Promise<RegisterResult> {
  const r = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  return asJson(r)
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/auth/email/verify/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  await asJson(r)
}

export async function createOrganisation(name: string): Promise<Organisation> {
  const r = await fetch(`${API}/api/v1/organisations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return asJson(r)
}

export async function updateOrganisation(orgId: string, fields: Partial<Organisation>): Promise<Organisation> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  return asJson(r)
}

export async function setOrganisationIndustry(orgId: string, industryId: string): Promise<Organisation> {
  return updateOrganisation(orgId, { industry_id: industryId })
}

export async function setOrganisationRiskProfile(
  orgId: string,
  riskProfile: 'low' | 'standard' | 'high'
): Promise<Organisation> {
  return updateOrganisation(orgId, { risk_profile: riskProfile })
}

export async function generateAmlProgram(orgId: string): Promise<AmlProgram> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}/aml-program/generate`, {
    method: 'POST',
    credentials: 'include',
  })
  return asJson(r)
}

export interface RiskFactor {
  factor: string
  label: string
  description: string
  rating: string
}

export interface RiskAssessment {
  industry_id: string
  risk_profile: string
  overall_rating: string
  factors: RiskFactor[]
}

export async function generateRiskAssessment(orgId: string): Promise<RiskAssessment> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}/risk-assessment/generate`, {
    method: 'POST',
    credentials: 'include',
  })
  return asJson(r)
}

export async function acknowledgeAmlAccountability(orgId: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}/aml-accountability/ack`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledged: true }),
  })
  await asJson(r)
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
  const r = await fetch(`${API}/api/v1/customers/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return asJson(r)
}
