// Typed industry-tenants client — thirty-first pilot for the shared
// lib/api/client.ts pattern. Covers app/industry/page.tsx's 6
// /api/v1/tenants/* call sites: list, stats, suspend, activate,
// update, create. The route file also has GET /{id} (added here for
// the detail-fetch fix below) and GET /by-industry/{id} -- the latter
// isn't called by this page, so scope matched what actually exists.
// This is the admin-facing platform tenant-management page -- distinct
// from the public marketing page of a similar name.
//
// Types mirror app/schemas/tenant.py's TenantSummary/TenantResponse.
// Every endpoint here is gated by _require_super_admin (tenants are
// platform-wide records, not org-scoped).

import { apiGet, apiPatch, apiPost } from './client'

/** GET /tenants/ -- mirrors TenantSummary, a slim list shape. Notably
 * has no `display_name`, `contact_name`, `phone`, `abn`, `austrac_id`,
 * `settings`, or `branding` -- those exist only on the full
 * `Tenant`/TenantResponse detail shape, confirmed by reading the
 * schema. The page's detail panel used to populate directly off a
 * list row (the same bug class already found in `mlro`/
 * `monitoring-rules`/`governance/calendar`): invisible while the page
 * falls back to its hardcoded DEMO_TENANTS (which has every field
 * filled in), but every one of those fields would show "—" or "Not
 * registered" the moment a real backend list replaced the demo data. */
export interface TenantListItem {
  tenant_id: string
  industry_id: string
  name: string
  status: string
  pack_id?: string | null
  contact_email?: string | null
  created_at?: string | null
}

/** GET /tenants/{id}, POST .../suspend, .../activate, PATCH /tenants/{id},
 * POST /tenants/ -- mirrors TenantResponse. `id` (the internal numeric
 * PK) is marked optional here even though the backend always returns
 * it, because this page never reads it and the detail-fetch-failure
 * fallback below assigns a `TenantListItem` (which has no `id`) into
 * this type. */
export interface Tenant {
  id?: number
  tenant_id: string
  industry_id: string
  name: string
  display_name?: string | null
  contact_email?: string | null
  contact_name?: string | null
  phone?: string | null
  abn?: string | null
  austrac_id?: string | null
  pack_id?: string | null
  status: string
  settings?: Record<string, unknown> | null
  branding?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TenantStats {
  total: number
  active: number
  suspended: number
  pending: number
}

export interface TenantCreateInput {
  industry_id: string
  name: string
  display_name?: string
  contact_email?: string
  contact_name?: string
  phone?: string
  abn?: string
  austrac_id?: string
  pack_id?: string
  status?: string
}

// Nullable (not just optional) to match what the edit form actually sends --
// its state is seeded from `Tenant`'s already-nullable fields (see
// app/industry/page.tsx's setEditForm), and the backend's
// exclude_none=True treats an explicit null the same as an omitted field.
export interface TenantUpdateInput {
  name?: string | null
  display_name?: string | null
  contact_email?: string | null
  contact_name?: string | null
  phone?: string | null
  abn?: string | null
  austrac_id?: string | null
  pack_id?: string | null
  status?: string | null
}

/** GET /tenants/. Passes an explicit, generous limit -- the bare
 * endpoint's own default (100) is unlikely to truncate a platform-wide
 * tenant list in practice, but there's no pagination UI on this page
 * to recover anything past it either way. */
export function listTenants(limit = 500): Promise<TenantListItem[]> {
  return apiGet(`/api/v1/tenants/?limit=${limit}`)
}

/** GET /tenants/stats */
export function getTenantStats(): Promise<TenantStats> {
  return apiGet('/api/v1/tenants/stats')
}

/** GET /tenants/{id} */
export function getTenant(tenantId: string): Promise<Tenant> {
  return apiGet(`/api/v1/tenants/${tenantId}`)
}

/** POST /tenants/ */
export function createTenant(payload: TenantCreateInput): Promise<Tenant> {
  return apiPost('/api/v1/tenants/', payload)
}

/** PATCH /tenants/{id} */
export function updateTenant(tenantId: string, payload: TenantUpdateInput): Promise<Tenant> {
  return apiPatch(`/api/v1/tenants/${tenantId}`, payload)
}

/** POST /tenants/{id}/suspend */
export function suspendTenant(tenantId: string): Promise<Tenant> {
  return apiPost(`/api/v1/tenants/${tenantId}/suspend`)
}

/** POST /tenants/{id}/activate */
export function activateTenant(tenantId: string): Promise<Tenant> {
  return apiPost(`/api/v1/tenants/${tenantId}/activate`)
}
