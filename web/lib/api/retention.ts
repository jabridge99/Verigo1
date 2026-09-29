// Typed retention client — twenty-second pilot for the shared
// lib/api/client.ts pattern. Covers app/retention/page.tsx's 6
// /api/v1/retention/* call sites: list policies, list holds, purge
// report, set policy, place hold, release hold.
//
// Types mirror app/schemas/retention.py's PolicyResponse/HoldResponse
// and app/services/retention_service.py's generate_purge_report()
// literal return shape.

import { apiGet, apiPost, apiPut } from './client'

export const ENTITY_SCOPES = [
  'customer', 'kyc_record', 'document', 'transaction', 'audit_log', 'report',
] as const
export type EntityScope = (typeof ENTITY_SCOPES)[number]

/** GET /retention/policies, PUT /retention/policies — mirrors PolicyResponse.
 * `legal_hold` here is a standalone flag on the policy row itself, never
 * consulted by deletion-eligibility checks (those look at the separate
 * Hold table below) -- it's effectively write-only and unused elsewhere
 * in the backend, kept only because the response really does include it. */
export interface Policy {
  policy_id: string
  industry_id?: string | null
  entity_scope: EntityScope
  retention_years: number
  legal_hold: boolean
  notes?: string | null
  created_at?: string | null
}

/** GET/POST /retention/holds, POST /retention/holds/{id}/release — mirrors HoldResponse. */
export interface Hold {
  hold_id: string
  industry_id?: string | null
  entity_scope: EntityScope
  entity_id: string
  reason: string
  held_by?: string | null
  placed_at?: string | null
  released_at?: string | null
  active: boolean
}

export interface PurgeItem {
  scope: string
  id: string
  created_at: string | null
  action: string
}

/** GET /retention/purge-report */
export interface PurgeReport {
  generated_at: string
  industry_id?: string | null
  items: PurgeItem[]
  total_eligible: number
}

export interface PolicyUpsertInput {
  entity_scope: EntityScope
  retention_years: number
  legal_hold?: boolean
  notes?: string
}

export interface HoldCreateInput {
  entity_scope: EntityScope
  entity_id: string
  reason: string
}

/** GET /retention/policies */
export function listRetentionPolicies(): Promise<Policy[]> {
  return apiGet('/api/v1/retention/policies')
}

/** PUT /retention/policies */
export function setRetentionPolicy(payload: PolicyUpsertInput): Promise<Policy> {
  return apiPut('/api/v1/retention/policies', payload)
}

/** GET /retention/holds?active_only=... */
export function listLegalHolds(activeOnly = true): Promise<Hold[]> {
  return apiGet(`/api/v1/retention/holds?active_only=${activeOnly}`)
}

/** POST /retention/holds */
export function placeLegalHold(payload: HoldCreateInput): Promise<Hold> {
  return apiPost('/api/v1/retention/holds', payload)
}

/** POST /retention/holds/{id}/release */
export function releaseLegalHold(holdId: string): Promise<Hold> {
  return apiPost(`/api/v1/retention/holds/${holdId}/release`)
}

/** GET /retention/purge-report */
export function getPurgeReport(): Promise<PurgeReport> {
  return apiGet('/api/v1/retention/purge-report')
}
