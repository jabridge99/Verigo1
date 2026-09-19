// Typed billing-resource client — third pilot for the shared
// lib/api/client.ts pattern (see customers.ts / analytics.ts for the
// first two). Covers app/billing/page.tsx's billing-specific call sites
// only — that page also calls /api/v1/storage/* (a genuinely separate
// backend resource, app/api/routes/storage.py) which is left untouched.
//
// lib/pricing.ts's fetchPlanPrices() also hits GET /billing/plans, but
// deliberately isn't migrated here: it's a public, unauthenticated,
// server-side/ISR-cached fetch (`next: { revalidate: 300 }`), a different
// execution context from apiFetch()'s client-only Bearer/CSRF handling —
// forcing it through this client would add auth machinery a public
// marketing-page fetch doesn't need and doesn't want.
//
// Types mirror app/schemas/billing.py.

import { apiGet, apiPatch, apiPost } from './client'

export type BillingPlan = 'starter' | 'professional' | 'enterprise' | 'vvip' | 'free_trial'
export type BillingInterval = 'monthly' | 'annual'
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'free_trial'

export interface Plan {
  plan: string
  name: string
  monthly_aud: number | null
  annual_aud: number | null
  annual_discount_pct: number
  features: string[]
  limits: Record<string, number>
}

export interface Subscription {
  id: number
  subscription_id: string
  industry_id: string
  plan: BillingPlan
  interval: BillingInterval
  status: SubscriptionStatus
  base_price_aud: number | null
  custom_monthly_aud: number | null
  custom_annual_aud: number | null
  annual_discount_pct: number
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  trial_ends_at?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  cancel_at_period_end: boolean
  notes?: string | null
  created_at?: string | null
}

export interface Invoice {
  id: number
  invoice_id: string
  subscription_id?: string | null
  amount_aud: number
  tax_aud: number
  total_aud: number
  status: string
  description?: string | null
  period_start?: string | null
  period_end?: string | null
  due_date?: string | null
  paid_at?: string | null
  stripe_hosted_url?: string | null
  stripe_pdf_url?: string | null
  created_at?: string | null
}

export interface FeatureToggleRow {
  code: string
  name: string
  category?: string | null
  plans: Record<string, boolean>
}

export interface CheckoutSessionResponse {
  checkout_url: string
  session_id: string
}

export interface CustomerPortalResponse {
  portal_url: string
}

/** GET /billing/plans — public. */
export function listPlans(discountPct?: number): Promise<Plan[]> {
  const q = discountPct != null ? `?discount_pct=${discountPct}` : ''
  return apiGet(`/api/v1/billing/plans${q}`)
}

/** GET /billing/subscription */
export function getMySubscription(): Promise<Subscription> {
  return apiGet('/api/v1/billing/subscription')
}

/** GET /billing/invoices */
export function listInvoices(limit?: number): Promise<Invoice[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/billing/invoices${q}`)
}

export interface CheckoutInput {
  plan: string
  interval: BillingInterval
  success_url: string
  cancel_url: string
}

/** POST /billing/checkout — create a brand-new Stripe subscription. */
export function createCheckout(payload: CheckoutInput): Promise<CheckoutSessionResponse> {
  return apiPost('/api/v1/billing/checkout', payload)
}

/** POST /billing/subscription/change-plan — modify an existing subscription in place. */
export function changePlan(plan: string, interval: BillingInterval): Promise<Subscription> {
  return apiPost('/api/v1/billing/subscription/change-plan', { plan, interval })
}

/** GET /billing/portal */
export function getCustomerPortalUrl(returnUrl?: string): Promise<CustomerPortalResponse> {
  const q = returnUrl ? `?return_url=${encodeURIComponent(returnUrl)}` : ''
  return apiGet(`/api/v1/billing/portal${q}`)
}

/** POST /billing/subscription/cancel */
export function cancelSubscription(atPeriodEnd = true): Promise<Subscription> {
  return apiPost(`/api/v1/billing/subscription/cancel?at_period_end=${atPeriodEnd}`)
}

/** GET /billing/admin/all — super-admin only. */
export function adminListAllSubscriptions(limit?: number): Promise<Subscription[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return apiGet(`/api/v1/billing/admin/all${q}`)
}

export interface AdminSubscriptionUpdate {
  plan?: string
  interval?: BillingInterval
  status?: SubscriptionStatus
  custom_monthly_aud?: number
  custom_annual_aud?: number
  annual_discount_pct?: number
  notes?: string
}

/** PATCH /billing/admin/{industry_id} — super-admin VVIP/price override. */
export function adminUpdateSubscription(
  industryId: string,
  payload: AdminSubscriptionUpdate,
  organisationId?: string
): Promise<Subscription> {
  const q = organisationId ? `?organisation_id=${encodeURIComponent(organisationId)}` : ''
  return apiPatch(`/api/v1/billing/admin/${encodeURIComponent(industryId)}${q}`, payload)
}

/** POST /billing/admin/{industry_id}/activate — super-admin only. */
export function adminActivateSubscription(
  industryId: string,
  organisationId?: string
): Promise<Subscription> {
  const q = organisationId ? `?organisation_id=${encodeURIComponent(organisationId)}` : ''
  return apiPost(`/api/v1/billing/admin/${encodeURIComponent(industryId)}/activate${q}`)
}

/** POST /billing/admin/{industry_id}/terminate — super-admin only. */
export function adminTerminateSubscription(
  industryId: string,
  organisationId?: string
): Promise<Subscription> {
  const q = organisationId ? `?organisation_id=${encodeURIComponent(organisationId)}` : ''
  return apiPost(`/api/v1/billing/admin/${encodeURIComponent(industryId)}/terminate${q}`)
}

/** GET /billing/admin/features — super-admin only. */
export function adminFeatureMatrix(): Promise<FeatureToggleRow[]> {
  return apiGet('/api/v1/billing/admin/features')
}

/** PATCH /billing/admin/features/{plan}/{feature_code} — super-admin only. */
export function adminToggleFeature(
  plan: string,
  featureCode: string,
  enabled: boolean
): Promise<FeatureToggleRow> {
  return apiPatch(
    `/api/v1/billing/admin/features/${encodeURIComponent(plan)}/${encodeURIComponent(featureCode)}`,
    { enabled }
  )
}
