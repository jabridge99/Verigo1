// Typed security-monitor client — twenty-ninth pilot for the shared
// lib/api/client.ts pattern. Covers app/security/page.tsx's 4
// /api/v1/security/* call sites: summary, alerts, mfa-status, events.
// The route file also has /failed-logins and /role-changes — neither
// called by this page, so scope matched what actually exists.
//
// Types mirror app/api/routes/security_monitor.py's literal return
// shapes. Every endpoint here is gated by _require_super_admin, a
// stricter check than the module docstring's "restricted to admin/mlro"
// suggests (an org-scoped admin/mlro is refused with 403 "Requires
// global super-admin access" -- SecurityEvent has no org_id column, so
// this data is platform-wide and deliberately global-super-admin-only
// until it gains real per-tenant scoping). The page's own error banner
// used to hardcode "ensure you are logged in as admin/mlro" regardless
// of the real reason, and its old local apiFetch() never parsed the
// response body, so it only ever showed "403 Forbidden" rather than the
// backend's actual, more specific detail message -- switching to the
// shared client (which does parse `.detail`) surfaces that message, so
// the hint text was corrected to match.

import { apiGet } from './client'

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

/** GET /security/alerts -- mirrors active_alerts(). Only `critical`
 * (brute_force) and `high` (role_escalation, mfa_disabled) are ever
 * actually emitted today; `medium`/`low` exist in the page's colour map
 * for severities no current alert type produces. */
export interface SecurityAlert {
  severity: AlertSeverity
  type: string
  message: string
  ip_address?: string
}

export interface ActiveAlertsResponse {
  alert_count: number
  alerts: SecurityAlert[]
}

export interface BruteForceCandidate {
  ip: string
  failed_attempts: number
}

/** GET /security/summary?days=... */
export interface SecuritySummary {
  period_days: number
  total_events: number
  failed_logins: number
  mfa_failures: number
  role_changes: number
  user_suspensions: number
  invalid_magic_links: number
  brute_force_candidates: BruteForceCandidate[]
}

/** GET /security/mfa-status */
export interface MfaStatus {
  total_users: number
  mfa_enabled: number
  mfa_disabled: number
  adoption_pct: number
}

export interface SecurityEvent {
  event_id: string
  event_type: string
  user_id?: string | null
  ip_address?: string | null
  created_at: string | null
}

/** GET /security/events?days=...&limit=... */
export interface SecurityEventsResponse {
  total: number
  events: SecurityEvent[]
}

/** GET /security/summary?days=... */
export function getSecuritySummary(days: number): Promise<SecuritySummary> {
  return apiGet(`/api/v1/security/summary?days=${days}`)
}

/** GET /security/alerts */
export function getSecurityAlerts(): Promise<ActiveAlertsResponse> {
  return apiGet('/api/v1/security/alerts')
}

/** GET /security/mfa-status */
export function getMfaStatus(): Promise<MfaStatus> {
  return apiGet('/api/v1/security/mfa-status')
}

/** GET /security/events?days=...&limit=... */
export function getSecurityEvents(days: number, limit = 20): Promise<SecurityEventsResponse> {
  return apiGet(`/api/v1/security/events?days=${days}&limit=${limit}`)
}
