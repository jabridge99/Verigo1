// Typed customers-resource client — pilot for the shared lib/api/client.ts
// pattern. Covers exactly the customer endpoints the frontend actually
// calls today (app/customers/page.tsx, app/customers/[id]/page.tsx,
// app/ecdd/page.tsx, app/monitoring/page.tsx, lib/signup.ts) — not the
// full backend surface (see app/api/routes/customers/ for that). Types
// mirror app/schemas/customer.py's CustomerResponse/CustomerOverrideRequest/
// CustomerCreate.

import { apiGet, apiPost } from './client'

export type CustomerType =
  | 'individual'
  | 'sole_trader'
  | 'company'
  | 'trust'
  | 'partnership'
  | 'association'

export type CustomerStatus =
  | 'draft'
  | 'pending'
  | 'kyc_in_progress'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'edd_required'
  | 'active'
  | 'suspended'
  | 'closed'
  | 'rejected'

export type CDDLevel = 'simplified' | 'standard' | 'enhanced'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CustomerSummary {
  id: string
  customer_ref: string
  org_id: string
  customer_type: CustomerType
  status: CustomerStatus
  cdd_level: CDDLevel
  full_name: string
  date_of_birth?: string | null
  country_of_birth?: string | null
  nationality?: string | null
  country_of_residence?: string | null
  occupation?: string | null
  employer_name?: string | null
  tax_residency_country?: string | null
  fatca_applicable: boolean
  crs_applicable: boolean
  email?: string | null
  phone?: string | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  risk_level: RiskLevel
  risk_score: number
  is_pep: boolean
  pep_type?: string | null
  is_sanctions_match: boolean
  is_adverse_media: boolean
  source_of_funds?: string | null
  source_of_wealth?: string | null
  onboarding_channel?: string | null
  relationship_manager?: string | null
  last_reviewed_date?: string | null
  next_review_date?: string | null
  onboarded_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ListCustomersParams {
  limit?: number
  search?: string
  status?: string
  riskLevel?: string
}

/** GET /customers — analyst+. Matches app/api/routes/customers/crud.py::list_customers. */
export function listCustomers(params: ListCustomersParams = {}): Promise<CustomerSummary[]> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  if (params.riskLevel) qs.set('risk_level', params.riskLevel)
  const query = qs.toString()
  return apiGet<CustomerSummary[]>(`/api/v1/customers/${query ? `?${query}` : ''}`)
}

export interface CustomerWorkspace {
  customer: CustomerSummary
  business_detail: unknown
  beneficial_owners: unknown[]
  documents: unknown[]
  corporate_documents: unknown[]
  screening: {
    records: unknown[]
    latest_by_type: Record<string, unknown>
    open_alerts: unknown[]
  }
  onboarding_checklist: unknown
  risk: { risk_score: number; risk_level: string; history: unknown[] }
  sof_sow: {
    source_of_funds?: string
    source_of_funds_verified?: boolean
    source_of_wealth?: string
    source_of_wealth_verified?: boolean
  }
  cdd: {
    cdd_level?: string
    last_reviewed_date?: string
    last_reviewed_by?: string
    next_review_date?: string
  }
  reviews: unknown[]
  notes: unknown[]
  cases: { open: unknown[]; closed: unknown[]; escalated: unknown[]; smr_linked: unknown[] }
  transactions: { recent: unknown[]; total_count: number; recent_volume_aud: number }
  assigned_officer?: string
}

/** GET /customers/{id}/workspace — analyst+. */
export function getCustomerWorkspace(id: string): Promise<CustomerWorkspace> {
  return apiGet<CustomerWorkspace>(`/api/v1/customers/${encodeURIComponent(id)}/workspace`)
}

export interface CustomerTimelineEvent {
  type: string
  label: string
  at: string
  actor?: string | null
  detail?: unknown
}

export interface CustomerTimeline {
  customer_id: string
  total_events: number
  transaction_count: number
  events: CustomerTimelineEvent[]
}

/** GET /customers/{id}/timeline — analyst+. */
export function getCustomerTimeline(id: string, limit = 200): Promise<CustomerTimeline> {
  return apiGet<CustomerTimeline>(
    `/api/v1/customers/${encodeURIComponent(id)}/timeline?limit=${limit}`
  )
}

export interface CustomerOverrideInput {
  reason: string
  risk_score?: number
  risk_level?: RiskLevel
  cdd_level?: CDDLevel
  status?: CustomerStatus
  relationship_manager?: string
  next_review_date?: string
  classification?: string
  monitoring_level?: string
}

/** POST /customers/{id}/override — mlro+. */
export function overrideCustomer(
  id: string,
  payload: CustomerOverrideInput
): Promise<CustomerSummary> {
  return apiPost<CustomerSummary>(
    `/api/v1/customers/${encodeURIComponent(id)}/override`,
    payload
  )
}

/**
 * Mirrors app/schemas/customer.py's CustomerCreate — every field but
 * full_name is optional there, so only that one is required here. This is
 * intentionally wider than CustomerSummary (the response shape): fields
 * like mail_address_line1 or tax_identification_number only exist on the
 * create request, not the response.
 */
export interface CustomerCreateInput {
  full_name: string
  customer_type?: CustomerType
  date_of_birth?: string
  country_of_birth?: string
  nationality?: string
  dual_nationality?: string
  country_of_residence?: string
  occupation?: string
  employer_name?: string
  employer_address?: string
  tax_residency_country?: string
  tax_identification_number?: string
  fatca_applicable?: boolean
  crs_applicable?: boolean
  email?: string
  phone?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
  mail_same_as_residential?: boolean
  mail_address_line1?: string
  mail_city?: string
  mail_state?: string
  mail_postcode?: string
  mail_country?: string
  source_of_funds?: string
  source_of_wealth?: string
  onboarding_channel?: string
  introduced_by?: string
  relationship_manager?: string
  is_reporting_group_member?: boolean
}

/** POST /customers — analyst+. */
export function createCustomer(payload: CustomerCreateInput): Promise<CustomerSummary> {
  return apiPost<CustomerSummary>('/api/v1/customers/', payload)
}
