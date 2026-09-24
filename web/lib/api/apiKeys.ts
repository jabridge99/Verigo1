// Typed api-keys-resource client — eighteenth pilot for the shared
// lib/api/client.ts pattern. Covers app/api-keys/page.tsx's
// /api/v1/api-keys/* call sites. Its sibling resource, webhooks (a
// genuinely separate backend router — app/api/routes/webhooks.py,
// split out from this one in an earlier refactor per that file's own
// docstring), lives in ./webhooks.ts; both are migrated together in
// this pass since they're used together on the one "API Keys &
// Webhooks" page. GET /api-keys/events (the webhook-event enum list)
// isn't called by the page, so it's left out.
//
// Types mirror app/schemas/api_key.py's APIKeyResponse/APIKeyCreated/
// APIKeyCreate.

import { apiGet, apiPost, apiDelete } from './client'

export interface ApiKey {
  id: number
  key_id: string
  name: string
  key_prefix: string
  user_id: string
  industry_id?: string | null
  status: string
  scopes: string[]
  last_used_at?: string | null
  expires_at?: string | null
  created_at?: string | null
}

export interface ApiKeyCreated extends ApiKey {
  raw_key: string
}

export interface CreateApiKeyInput {
  name: string
  scopes?: string[]
  expires_days?: number | null
}

/** GET /api-keys */
export function listApiKeys(): Promise<ApiKey[]> {
  return apiGet('/api/v1/api-keys')
}

/** POST /api-keys */
export function createApiKey(payload: CreateApiKeyInput): Promise<ApiKeyCreated> {
  return apiPost('/api/v1/api-keys', payload)
}

/** DELETE /api-keys/{id} */
export function revokeApiKey(keyId: string): Promise<void> {
  return apiDelete(`/api/v1/api-keys/${keyId}`)
}
