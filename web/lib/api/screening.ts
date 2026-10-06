// Typed screening-resource client — ninth pilot for the shared
// lib/api/client.ts pattern. Covers app/screening/page.tsx's and
// components/Onboarding/ScreeningStep.tsx's /api/v1/screening/*
// call sites only — the backend's screening route package
// (app/api/routes/screening/) also has alerts/adverse-media/batch/
// crypto-wallet/dashboard/records endpoints no frontend file calls,
// so they're not represented here.
//
// Types mirror app/api/routes/screening/quick_screen.py's response
// dicts and app/services/identity_composite_score.py's
// compute_identity_score() return shape.

import { apiGet, apiPost } from './client'

export type QuickScreenCategory = 'sanctions' | 'pep' | 'adverse_media' | 'company' | 'address'

export interface QuickScreenResult {
  category: string
  query: string
  match_found?: boolean
  matches?: { name: string; id: string; list: string }[]
  lists_checked?: string[]
  match_count?: number
  status?: string
  provider_reference?: string
  valid?: boolean
  normalized?: string
  note?: string
  disclaimer: string
}

/** POST /screening/quick-screen — ad-hoc lookup, not linked to a customer record. */
export function quickScreen(category: QuickScreenCategory, query: string): Promise<QuickScreenResult> {
  return apiPost('/api/v1/screening/quick-screen', { category, query })
}

export interface IdentityScoreCategory {
  score: number
  status: string
  label: string
}

export interface IdentityScore {
  customer_id: string
  composite_score: number
  decision: 'pass' | 'ecdd_required' | 'fail'
  breakdown: Record<string, IdentityScoreCategory>
  weight_per_category: number
}

export interface IdentityScoreDecision extends IdentityScore {
  customer_status: string
}

/** GET /screening/customers/{id}/identity-score */
export function getCustomerIdentityScore(customerId: string): Promise<IdentityScore> {
  return apiGet(`/api/v1/screening/customers/${customerId}/identity-score`)
}

/** POST /screening/customers/{id}/identity-score/decide — applies the decision to the customer's KYC status. */
export function decideCustomerIdentityScore(customerId: string): Promise<IdentityScoreDecision> {
  return apiPost(`/api/v1/screening/customers/${customerId}/identity-score/decide`)
}
