// Typed storage-resource client — fifth pilot for the shared
// lib/api/client.ts pattern. Covers app/billing/page.tsx's
// /api/v1/storage/* call sites — deliberately left on raw apiFetch()
// during the billing pilot (C2 pass 13) since it's a genuinely separate
// backend resource (app/api/routes/storage.py: bring-your-own document
// storage config), just surfaced as a tab on the billing page.
//
// Types mirror app/schemas/storage.py.

import { apiDelete, apiGet, apiPut } from './client'

export interface StorageConfig {
  backend: string
  bucket?: string | null
  region?: string | null
  access_key?: string | null
  endpoint_url?: string | null
  account_name?: string | null
  container?: string | null
  configured: boolean
  verified?: boolean | null
}

// The PUT body's shape varies by backend (s3/azure/gcs each take a
// different field set, including write-only secrets like secret_key/
// account_key/credentials_json that never come back in the response) —
// a plain string record, matching how the page's own form state already
// models it.
export type StorageConfigInput = Record<string, string>

/** GET /storage/config */
export function getMyStorageConfig(): Promise<StorageConfig> {
  return apiGet('/api/v1/storage/config')
}

/** PUT /storage/config */
export function setMyStorageConfig(payload: StorageConfigInput): Promise<StorageConfig> {
  return apiPut('/api/v1/storage/config', payload)
}

/** DELETE /storage/config — revert to the platform default. */
export function clearMyStorageConfig(): Promise<StorageConfig> {
  return apiDelete('/api/v1/storage/config')
}

/** GET /storage/admin/{industry_id} — super-admin only. */
export function adminGetStorageConfig(industryId: string): Promise<StorageConfig> {
  return apiGet(`/api/v1/storage/admin/${encodeURIComponent(industryId)}`)
}

/** PUT /storage/admin/{industry_id} — super-admin only. */
export function adminSetStorageConfig(industryId: string, payload: StorageConfigInput): Promise<StorageConfig> {
  return apiPut(`/api/v1/storage/admin/${encodeURIComponent(industryId)}`, payload)
}

/** DELETE /storage/admin/{industry_id} — super-admin only, revert to the platform default. */
export function adminClearStorageConfig(industryId: string): Promise<StorageConfig> {
  return apiDelete(`/api/v1/storage/admin/${encodeURIComponent(industryId)}`)
}
