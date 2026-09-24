// Typed webhooks-resource client — companion to ./apiKeys.ts (see its
// header comment) for the eighteenth C2 pilot pass. Covers
// app/api-keys/page.tsx's /api/v1/webhooks/* call sites: list, create,
// delete, and test. `PATCH /webhooks/{id}` (update) and
// `GET /webhooks/{id}/deliveries` aren't called by the page, so left
// out.
//
// Types mirror app/schemas/api_key.py's WebhookResponse/WebhookCreate,
// and app/api/routes/webhooks.py's test_webhook() literal return dict.

import { apiGet, apiPost, apiDelete } from './client'

export interface WebhookEndpoint {
  id: number
  webhook_id: string
  name: string
  url: string
  events: string[]
  user_id: string
  industry_id?: string | null
  status: string
  failure_count: number
  last_fired_at?: string | null
  created_at?: string | null
}

export interface CreateWebhookInput {
  name: string
  url: string
  events: string[]
}

export interface WebhookTestResult {
  success: boolean
  status_code?: number | null
}

/** GET /webhooks */
export function listWebhooks(): Promise<WebhookEndpoint[]> {
  return apiGet('/api/v1/webhooks')
}

/** POST /webhooks */
export function createWebhook(payload: CreateWebhookInput): Promise<WebhookEndpoint> {
  return apiPost('/api/v1/webhooks', payload)
}

/** DELETE /webhooks/{id} */
export function deleteWebhook(webhookId: string): Promise<void> {
  return apiDelete(`/api/v1/webhooks/${webhookId}`)
}

/** POST /webhooks/{id}/test */
export function testWebhook(webhookId: string): Promise<WebhookTestResult> {
  return apiPost(`/api/v1/webhooks/${webhookId}/test`)
}
