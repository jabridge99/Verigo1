import { signWebhook, verifyWebhook, sha256 } from '../lib/crypto.js'
import { dispatchWebhook } from '../lib/api.js'
import { audit, AUDIT_ACTIONS } from '../lib/audit.js'
import { bus, VALID_EVENTS } from '../lib/eventBus.js'
import { can, RbacError } from '../lib/rbac.js'

export const MAX_DELIVERY_FAILURES = 3
export const WEBHOOK_TIMEOUT_MS    = 10_000

// In-memory state
const endpoints  = new Map()   // endpointId → record
const deliveries = []          // append-only delivery log

function validateHttpsUrl(url) {
  if (typeof url !== 'string') throw new Error('URL must be a string')
  if (!url.startsWith('https://')) throw new Error(`Webhook URL must use HTTPS. Received: ${url}`)
  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL format: ${url}`)
  }
}

function validateEvents(events) {
  if (!Array.isArray(events) || events.length === 0) throw new Error('events must be a non-empty array')
  const invalid = events.filter(e => !VALID_EVENTS.has(e))
  if (invalid.length > 0) throw new Error(`Unknown events: ${invalid.join(', ')}. Valid events are: ${[...VALID_EVENTS].join(', ')}`)
}

export async function registerEndpoint(entityId, entityType, url, events, secret, { actor } = {}) {
  if (!entityId)   throw new Error('entityId is required')
  if (!entityType) throw new Error('entityType is required')
  if (!secret || secret.length < 16) throw new Error('secret must be at least 16 characters')

  validateHttpsUrl(url)
  validateEvents(events)

  const secretHash = await sha256(secret)
  const endpointId = crypto.randomUUID()
  const now        = new Date().toISOString()

  const record = {
    id:             endpointId,
    entityId,
    entityType,
    url,
    events:         [...new Set(events)],
    secretHash,
    active:         true,
    lastDeliveryAt: null,
    failureCount:   0,
    createdAt:      now,
    updatedAt:      now,
  }

  endpoints.set(endpointId, record)

  await audit(AUDIT_ACTIONS.CONFIG_CHANGED, {
    actor:      actor ?? entityId,
    entityId,
    entityType,
    after:      { endpointId, url, events: record.events, active: true },
    meta:       { action: 'webhook.endpoint.registered' },
  })

  return { endpointId, secretHint: `${secret.slice(0, 4)}...` }
}

export async function dispatchEvent(event, payload, { targetEntityId } = {}) {
  if (!VALID_EVENTS.has(event)) throw new Error(`Unknown event: ${event}`)

  const targets = [...endpoints.values()].filter(ep => {
    if (!ep.active) return false
    if (!ep.events.includes(event)) return false
    if (targetEntityId && ep.entityId !== targetEntityId) return false
    return true
  })

  const results = await Promise.allSettled(
    targets.map(ep => _deliverToEndpoint(ep, event, payload))
  )

  return {
    event,
    targets:   targets.length,
    succeeded: results.filter(r => r.status === 'fulfilled' && r.value?.success).length,
    failed:    results.filter(r => r.status === 'rejected'  || !r.value?.success).length,
  }
}

async function _deliverToEndpoint(endpoint, event, payload) {
  const body      = JSON.stringify({ event, ...payload, ts: new Date().toISOString() })
  const payloadHash = await sha256(body)

  let result
  try {
    result = await Promise.race([
      dispatchWebhook(endpoint.url, { event, ...payload }, { secret: endpoint.secretHash, entityId: endpoint.entityId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Webhook timeout')), WEBHOOK_TIMEOUT_MS)),
    ])
  } catch (err) {
    result = { success: false, error: err.message }
  }

  const deliveryId = crypto.randomUUID()
  const now        = new Date().toISOString()
  const status     = result?.success ? 'success' : 'failed'

  deliveries.push({
    id:             deliveryId,
    endpointId:     endpoint.id,
    event,
    payloadHash,
    status,
    attempt:        1,
    responseStatus: result?.status ?? null,
    deliveredAt:    now,
    error:          result?.error ?? null,
  })

  endpoint.lastDeliveryAt = now
  endpoint.updatedAt      = now

  if (!result?.success) {
    endpoint.failureCount++

    if (endpoint.failureCount >= MAX_DELIVERY_FAILURES) {
      endpoint.active    = false
      endpoint.updatedAt = now

      await audit(AUDIT_ACTIONS.CONFIG_CHANGED, {
        actor:      'system',
        entityId:   endpoint.entityId,
        entityType: endpoint.entityType,
        before:     { active: true, failureCount: endpoint.failureCount - 1 },
        after:      { active: false, failureCount: endpoint.failureCount },
        meta:       { reason: 'Exceeded max delivery failures', endpointId: endpoint.id },
      })

      bus.publish('platform.health.degraded', {
        reason:     'webhook_endpoint_deactivated',
        endpointId: endpoint.id,
        entityId:   endpoint.entityId,
        entityType: endpoint.entityType,
        failureCount: endpoint.failureCount,
      })
    }
  } else {
    endpoint.failureCount = 0
  }

  return { success: result?.success ?? false, deliveryId, status }
}

export async function verifyIncoming(payload, signature, secret) {
  if (!payload)   return { valid: false, reason: 'payload is required' }
  if (!signature) return { valid: false, reason: 'signature is required' }
  if (!secret)    return { valid: false, reason: 'secret is required' }

  if (!signature.startsWith('sha256=')) {
    return { valid: false, reason: 'signature must start with sha256=' }
  }

  try {
    const valid = await verifyWebhook(payload, signature, secret)
    return valid ? { valid: true } : { valid: false, reason: 'Signature mismatch' }
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` }
  }
}

export async function rotateSecret(endpointId, newSecret, { actor, context } = {}) {
  if (!can(context?.role, 'manage:webhooks')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'manage:webhooks'`, 'manage:webhooks')
  }
  if (!newSecret || newSecret.length < 16) throw new Error('newSecret must be at least 16 characters')

  const endpoint = endpoints.get(endpointId)
  if (!endpoint) throw new Error(`Webhook endpoint not found: ${endpointId}`)

  const newSecretHash    = await sha256(newSecret)
  const now              = new Date().toISOString()
  endpoint.secretHash    = newSecretHash
  endpoint.updatedAt     = now
  endpoint.failureCount  = 0

  await audit(AUDIT_ACTIONS.AUTH_TOKEN_REVOKED, {
    actor,
    entityId:   endpointId,
    entityType: 'webhook_endpoint',
    after:      { secretRotatedAt: now, secretHint: `${newSecret.slice(0, 4)}...` },
    meta:       { action: 'webhook.secret.rotated', context },
  })

  return { endpointId, rotatedAt: now, secretHint: `${newSecret.slice(0, 4)}...` }
}

export function getEndpoint(endpointId) {
  return endpoints.get(endpointId) ?? null
}

export function getEndpointsForEntity(entityId, entityType) {
  return [...endpoints.values()].filter(ep => ep.entityId === entityId && ep.entityType === entityType)
}

export function getDeliveries(endpointId, { limit = 50 } = {}) {
  const filtered = deliveries.filter(d => d.endpointId === endpointId)
  return filtered.slice(-limit)
}

export async function deactivateEndpoint(endpointId, { actor, context } = {}) {
  if (!can(context?.role, 'manage:webhooks')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'manage:webhooks'`, 'manage:webhooks')
  }

  const endpoint = endpoints.get(endpointId)
  if (!endpoint) throw new Error(`Webhook endpoint not found: ${endpointId}`)

  const before      = { active: endpoint.active }
  endpoint.active   = false
  endpoint.updatedAt = new Date().toISOString()

  await audit(AUDIT_ACTIONS.CONFIG_CHANGED, {
    actor,
    entityId:   endpoint.entityId,
    entityType: endpoint.entityType,
    before,
    after:      { active: false },
    meta:       { endpointId, action: 'webhook.endpoint.deactivated', context },
  })

  return { endpointId, active: false }
}
