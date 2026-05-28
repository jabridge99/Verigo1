// Cryptographic utilities — HMAC signing, webhook validation, PII helpers
// Uses Web Crypto API (available in all modern browsers and Node 18+)

const ENCODER = new TextEncoder()

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  )
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

// --- Webhook signing (HMAC-SHA256) ---

export async function signWebhook(payload, secret) {
  const key = await hmacKey(secret)
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(body))
  return `sha256=${bufToHex(sig)}`
}

export async function verifyWebhook(payload, signature, secret) {
  if (!signature?.startsWith('sha256=')) return false
  const key = await hmacKey(secret)
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const expected = hexToBuf(signature.slice(7))
  return crypto.subtle.verify('HMAC', key, expected, ENCODER.encode(body))
}

// --- Audit hash chain (SHA-256) ---

export async function sha256(data) {
  const buf = await crypto.subtle.digest('SHA-256', ENCODER.encode(
    typeof data === 'string' ? data : JSON.stringify(data)
  ))
  return bufToHex(buf)
}

// --- Idempotency key generation ---

export function generateIdempotencyKey(namespace, ...parts) {
  return `${namespace}:${parts.join(':')}:${crypto.randomUUID()}`
}

// --- API token generation ---

export function generateApiToken(prefix = 'eco') {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `${prefix}_${bufToHex(bytes)}`
}

// --- PII field masking (display only — real encryption needs server-side key) ---

export function maskEmail(email) {
  const [local, domain] = email.split('@')
  return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 4))}@${domain}`
}

export function maskPhone(phone) {
  return phone.replace(/\d(?=\d{4})/g, '*')
}

export function maskBSB(bsb) {
  return `***-${bsb.slice(-3)}`
}

// --- Token-bucket rate limiter (in-memory, per entity) ---

class RateLimiter {
  #buckets = new Map()

  check(entityId, { limit = 10, windowMs = 60_000 } = {}) {
    const now = Date.now()
    const bucket = this.#buckets.get(entityId) ?? { count: 0, resetAt: now + windowMs }
    if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + windowMs }
    bucket.count++
    this.#buckets.set(entityId, bucket)
    return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt }
  }
}

export const rateLimiter = new RateLimiter()
