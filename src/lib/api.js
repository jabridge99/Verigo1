// API client — retry logic, idempotency, auth headers, request/response logging

import { generateIdempotencyKey } from './crypto.js'
import { rateLimiter } from './crypto.js'
import { audit, AUDIT_ACTIONS } from './audit.js'

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000]
const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH'])

// Simulate network error probability for dev (0 = off)
const SIMULATED_FAILURE_RATE = 0

class ApiError extends Error {
  constructor(message, { status, code, requestId } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithRetry(url, options, attempt = 0) {
  if (SIMULATED_FAILURE_RATE > 0 && Math.random() < SIMULATED_FAILURE_RATE) {
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      return fetchWithRetry(url, options, attempt + 1)
    }
    throw new ApiError('Simulated network failure after max retries')
  }

  // In a real deployment this calls the actual API endpoint.
  // For the frontend-only build, it resolves from local data modules.
  throw new ApiError('API not connected — resolve from local data modules', { status: 0 })
}

export async function apiCall(endpoint, {
  method = 'GET',
  body,
  token,
  entityId,
  idempotencyKey,
  retries = RETRY_DELAYS_MS.length,
  rateLimit = { limit: 60, windowMs: 60_000 },
} = {}) {
  if (entityId) {
    const rl = rateLimiter.check(entityId, rateLimit)
    if (!rl.allowed) throw new ApiError('Rate limit exceeded', { status: 429 })
  }

  const iKey = IDEMPOTENT_METHODS.has(method)
    ? (idempotencyKey ?? generateIdempotencyKey('api', endpoint, body ? JSON.stringify(body) : ''))
    : undefined

  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(iKey   && { 'Idempotency-Key': iKey }),
  }

  const options = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithRetry(endpoint, options, attempt)
    } catch (err) {
      const retryable = !err.status || err.status >= 500 || err.status === 429
      if (!retryable || attempt === retries) throw err
      await sleep(RETRY_DELAYS_MS[attempt] ?? 32_000)
    }
  }
}

// Webhook dispatcher (outbound)
export async function dispatchWebhook(url, payload, { secret, entityId } = {}) {
  const { signWebhook } = await import('./crypto.js')
  const body = JSON.stringify({ ...payload, ts: new Date().toISOString() })
  const signature = secret ? await signWebhook(body, secret) : undefined

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'EcoBin-Webhooks/1.0',
    ...(signature && { 'X-EcoBin-Signature': signature }),
  }

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body })
      if (res.ok) return { success: true, status: res.status, attempt }
      if (res.status < 500) return { success: false, status: res.status, attempt }
    } catch {}
    await sleep(RETRY_DELAYS_MS[attempt])
  }
  return { success: false, exhausted: true }
}

export { ApiError }
