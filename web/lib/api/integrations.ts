// Typed integrations-hub client — twenty-eighth pilot for the shared
// lib/api/client.ts pattern. Covers app/api-integrations/page.tsx's 8
// /api/v1/integrations/* call sites: catalog, monitoring, audit-log,
// enable, test, rotate-credentials, disable, expiry-check.
//
// The route file also has a bare GET "" (list_org_integrations, a
// provider-enriched shape distinct from the catalog's per-provider
// org_integration), GET /catalog/{slug}, /oauth/authorize+/callback
// (both permanently 501 -- no provider has a real OAuth2 app configured,
// see PARKING_LOT.md P45), and /migrate-legacy-connectors -- none called
// by this page, so scope matched what actually exists.
//
// Types mirror app/api/routes/integrations.py's _integration_dict()/
// _provider_dict() literal return shapes and app/models/integration.py's
// enums. Note: audit-log requires compliance+ (require_compliance_or_above)
// while catalog/monitoring only require analyst+ -- an analyst can open
// this page's "audit" tab but the fetch 403s; the page's existing
// setError(e.message) surfaces that rather than crashing, so left as-is.

import { apiGet, apiPost } from './client'

export const CATEGORIES = [
  'kyc', 'screening', 'corporate_registry', 'address_validation',
  'credit_financial', 'crm', 'storage', 'communications', 'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export type IntegrationType = 'open_source' | 'free_api' | 'premium_api' | 'enterprise_api' | 'custom_api'
export type AuthType = 'api_key' | 'oauth2' | 'basic_auth' | 'bearer' | 'mtls' | 'custom' | 'none'
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

/** Embedded in Provider.org_integration -- mirrors _integration_dict(). */
export interface OrgIntegration {
  id: string
  provider_id: string
  provider_slug: string
  is_enabled: boolean
  config: Record<string, unknown>
  credentials_configured: boolean
  credential_expires_at?: string | null
  oauth_connected: boolean
  oauth_expires_at?: string | null
  health_status: HealthStatus
  last_tested_at?: string | null
  last_test_result?: boolean | null
  last_test_message?: string | null
  last_health_check_at?: string | null
  consecutive_failures: number
  usage_count: number
  last_used_at?: string | null
  enabled_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** GET /integrations/catalog -- mirrors _provider_dict(). `capabilities`
 * is always [] in practice: no PROVIDER_CATALOG entry or _seed_providers()
 * codepath ever populates it, despite the column existing. */
export interface Provider {
  id: string
  slug: string
  name: string
  category: Category
  integration_type: IntegrationType
  auth_type: AuthType
  description?: string | null
  is_active: boolean
  is_featured: boolean
  capabilities: string[]
  required_credentials: { key: string; label: string; secret?: boolean }[]
  optional_config: { key: string; label: string; default?: string }[]
  org_integration: OrgIntegration | null
}

/** GET /integrations/catalog */
export interface CatalogResponse {
  total_providers: number
  enabled_count: number
  by_category: Record<string, Provider[]>
  disclaimer: string
}

export interface MonitoringRow {
  provider_slug: string
  provider_name: string
  category?: string | null
  is_enabled: boolean
  health_status: HealthStatus
  consecutive_failures: number
  usage_count: number
  last_used_at?: string | null
}

export interface ExpiringCredential {
  provider_slug: string
  credential_type: string
  expires_at: string
}

/** GET /integrations/monitoring */
export interface MonitoringSummary {
  total_integrations: number
  enabled_count: number
  healthy_count: number
  degraded_or_down_count: number
  expiring_within_30_days: ExpiringCredential[]
  integrations: MonitoringRow[]
}

/** GET /integrations/audit-log */
export interface IntegrationAuditLogEntry {
  id: string
  provider_slug: string
  event_type: string
  success: boolean
  message: string
  actor_id: string
  created_at: string
}

export interface EnableIntegrationInput {
  credentials: Record<string, string>
  config?: Record<string, unknown>
  credential_expires_at?: string | null
}

export interface RotateCredentialsInput {
  new_credentials: Record<string, string>
  reason: string
  credential_expires_at?: string | null
}

export interface TestConnectionResult {
  slug: string
  test_passed: boolean
  message: string
  health_status: HealthStatus
  tested_at: string
}

export interface DisableResult {
  slug: string
  is_enabled: boolean
}

export interface RotateResult {
  slug: string
  rotated: boolean
  reason: string
}

export interface ExpiryCheckResult {
  checked: number
  flagged: ExpiringCredential[]
}

/** GET /integrations/catalog[?search=...] */
export function getIntegrationCatalog(search?: string): Promise<CatalogResponse> {
  const q = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet(`/api/v1/integrations/catalog${q}`)
}

/** GET /integrations/monitoring */
export function getIntegrationMonitoring(): Promise<MonitoringSummary> {
  return apiGet('/api/v1/integrations/monitoring')
}

/** GET /integrations/audit-log */
export function getIntegrationAuditLog(): Promise<IntegrationAuditLogEntry[]> {
  return apiGet('/api/v1/integrations/audit-log')
}

/** POST /integrations/{slug}/enable */
export function enableIntegration(slug: string, payload: EnableIntegrationInput): Promise<OrgIntegration> {
  return apiPost(`/api/v1/integrations/${slug}/enable`, payload)
}

/** POST /integrations/{slug}/disable */
export function disableIntegration(slug: string): Promise<DisableResult> {
  return apiPost(`/api/v1/integrations/${slug}/disable`)
}

/** POST /integrations/{slug}/test */
export function testIntegrationConnection(slug: string): Promise<TestConnectionResult> {
  return apiPost(`/api/v1/integrations/${slug}/test`)
}

/** POST /integrations/{slug}/rotate-credentials */
export function rotateIntegrationCredentials(slug: string, payload: RotateCredentialsInput): Promise<RotateResult> {
  return apiPost(`/api/v1/integrations/${slug}/rotate-credentials`, payload)
}

/** POST /integrations/expiry-check */
export function triggerIntegrationExpiryCheck(): Promise<ExpiryCheckResult> {
  return apiPost('/api/v1/integrations/expiry-check')
}
