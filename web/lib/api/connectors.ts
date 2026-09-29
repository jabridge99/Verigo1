// Typed legacy-connector-marketplace client — thirty-second pilot for the
// shared lib/api/client.ts pattern. Covers app/connectors/page.tsx's 3
// /api/v1/connectors/* call sites: list, test, delete (its 4th call site,
// migrate-legacy-connectors, hits the Integrations Hub resource and was
// added to lib/api/integrations.ts instead -- see that file). The route
// file also has GET /providers and PATCH /{id} -- neither called by this
// page, so scope matched what actually exists.
//
// This store is deprecated (superseded by the Integrations Hub) and kept
// read/delete/test-only -- POST here always 410s. Note a role-gate
// asymmetry: GET allows compliance+, but test/delete require admin/mlro
// (compliance excluded) -- confirmed by reading _require_roles() on each
// route; a compliance-role user can see their org's credentials but gets
// a real error (not a fabricated success) if they try to test or delete
// one, since the shared client throws on the 403 rather than swallowing it.
//
// Types mirror app/schemas/connector.py's ConnectorResponse and
// app/services/connector_service.py's test_credential() literal return.

import { apiGet, apiPost, apiDelete } from './client'

export type ConnectorProvider =
  | 'greenid' | 'sumsub' | 'trulioo' | 'jumio' | 'onfido'
  | 'complyadvantage' | 'lexisnexis' | 'dowjones' | 'worldcheck'
  | 'creditorwatch' | 'equifax_au' | 'loqate' | 'google_maps' | 'sendgrid' | 'twilio'

export type ConnectorStatus = 'active' | 'inactive' | 'error'

/** GET /connectors/ -- mirrors ConnectorResponse. */
export interface Connector {
  credential_id: string
  industry_id: string
  provider: ConnectorProvider
  label?: string | null
  key_hint?: string | null
  status: ConnectorStatus
  is_default: boolean
  last_tested_at?: string | null
  last_error?: string | null
  created_at?: string | null
}

/** POST /connectors/{id}/test -- mirrors test_credential()'s return. */
export interface ConnectorTestResult {
  success: boolean
  message: string
  provider: string
  credential_id: string
}

/** GET /connectors/[?provider=...] */
export function listConnectors(): Promise<Connector[]> {
  return apiGet('/api/v1/connectors/')
}

/** POST /connectors/{id}/test */
export function testConnector(credentialId: string): Promise<ConnectorTestResult> {
  return apiPost(`/api/v1/connectors/${credentialId}/test`)
}

/** DELETE /connectors/{id} -- 204 No Content on success. */
export function deleteConnector(credentialId: string): Promise<void> {
  return apiDelete(`/api/v1/connectors/${credentialId}`)
}
