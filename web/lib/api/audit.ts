// Typed audit-trail client — twenty-fourth pilot for the shared
// lib/api/client.ts pattern. Covers app/audit/page.tsx's 2
// /api/v1/audit/* call sites: list, CSV export.
//
// Types mirror app/schemas/audit.py's AuditLogResponse and
// app/api/routes/audit.py's _normalize_legacy()/_normalize_new()
// merge of the two underlying audit tables.

import { apiFetch } from '@/lib/auth'
import { API_BASE } from './client'
import { apiGet } from './client'

/** GET /audit/ — merges legacy_audit_logs (int id) and audit_logs (string
 * id like "aud_xxx"), so `id` is genuinely either type depending on which
 * table a row came from; `log_id` (always a string) is the one stable
 * identifier used for keys/lookups. Casing of entity_type/actor_role also
 * differs by source table -- the API returns it raw, uncorrected. */
export interface AuditLog {
  id: number | string
  log_id: string
  action: string
  entity_type: string
  entity_id: string
  actor?: string | null
  actor_role?: string | null
  industry_id?: string | null
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  notes?: string | null
  ip_address?: string | null
  created_at?: string | null
}

export interface ListAuditLogsFilters {
  entity_type?: string
  entity_id?: string
  actor?: string
  action?: string
  industry_id?: string
  skip?: number
  limit?: number
}

/** GET /audit/ */
export function listAuditLogs(filters: ListAuditLogsFilters = {}): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (filters.entity_type) params.set('entity_type', filters.entity_type)
  if (filters.entity_id) params.set('entity_id', filters.entity_id)
  if (filters.actor) params.set('actor', filters.actor)
  if (filters.action) params.set('action', filters.action)
  if (filters.industry_id) params.set('industry_id', filters.industry_id)
  if (filters.skip !== undefined) params.set('skip', String(filters.skip))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return apiGet(`/api/v1/audit/${qs ? `?${qs}` : ''}`)
}

/** GET /audit/export/csv — returns a raw CSV Blob, not JSON, so this
 * wraps apiFetch() directly rather than going through the shared
 * client's JSON-parsing convention (same pattern as documents.ts's
 * downloadDocument()). Throws on a non-ok response so the caller's
 * existing client-side CSV fallback still runs on failure. */
export async function exportAuditLogCsv(): Promise<Blob> {
  const res = await apiFetch(`${API_BASE}/api/v1/audit/export/csv`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  return res.blob()
}
