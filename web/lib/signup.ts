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

export async function setOrganisationIndustry(orgId: string, industryId: string): Promise<Organisation> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ industry_id: industryId }),
  })
  return asJson(r)
}

export async function setOrganisationRiskProfile(
  orgId: string,
  riskProfile: 'low' | 'standard' | 'high'
): Promise<Organisation> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ risk_profile: riskProfile }),
  })
  return asJson(r)
}

export async function generateAmlProgram(orgId: string): Promise<AmlProgram> {
  const r = await fetch(`${API}/api/v1/organisations/${orgId}/aml-program/generate`, {
    method: 'POST',
    credentials: 'include',
  })
  return asJson(r)
}
