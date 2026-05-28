// Queue-based job processing with idempotency, retry, and dead-letter support

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 32_000]
const MAX_RETRIES = 5

export const JOB_TYPES = {
  PAYOUT_PROCESS:      'payout.process',
  SETTLEMENT_BATCH:    'settlement.batch',
  FRAUD_EVALUATE:      'fraud.evaluate',
  WEBHOOK_DISPATCH:    'webhook.dispatch',
  PRICING_RECALCULATE: 'pricing.recalculate',
  AUDIT_FLUSH:         'audit.flush',
  KYC_VERIFY:          'kyc.verify',
}

function makeIdempotencyKey(type, entityId, dedupKey = '') {
  return `${type}:${entityId}:${dedupKey || Date.now()}`
}

class WorkQueue {
  #pending = []
  #processing = new Set()
  #deadLetter = []
  #seen = new Map()       // idempotencyKey → jobId (dedup within session)
  #handlers = new Map()
  #running = false

  enqueue(type, payload, { idempotencyKey, priority = 0, maxRetries = MAX_RETRIES } = {}) {
    const key = idempotencyKey ?? makeIdempotencyKey(type, payload.entityId ?? 'anon')
    if (this.#seen.has(key)) return { duplicate: true, jobId: this.#seen.get(key) }

    const job = {
      id: crypto.randomUUID(),
      type,
      payload,
      idempotencyKey: key,
      priority,
      maxRetries,
      attempts: 0,
      status: 'pending',
      enqueuedAt: Date.now(),
      nextRunAt: Date.now(),
    }
    this.#seen.set(key, job.id)
    this.#pending.push(job)
    this.#pending.sort((a, b) => b.priority - a.priority || a.nextRunAt - b.nextRunAt)
    return { duplicate: false, jobId: job.id }
  }

  register(type, handler) {
    this.#handlers.set(type, handler)
  }

  async #executeJob(job) {
    const handler = this.#handlers.get(job.type)
    if (!handler) {
      job.status = 'failed'
      job.error = `No handler registered for type: ${job.type}`
      this.#deadLetter.push(job)
      return
    }
    job.attempts++
    job.status = 'processing'
    this.#processing.add(job.id)
    try {
      job.result = await handler(job.payload, job)
      job.status = 'completed'
      job.completedAt = Date.now()
    } catch (err) {
      job.lastError = err.message
      if (job.attempts >= job.maxRetries) {
        job.status = 'dead'
        this.#deadLetter.push(job)
      } else {
        job.status = 'pending'
        job.nextRunAt = Date.now() + (RETRY_DELAYS_MS[job.attempts - 1] ?? 32_000)
        this.#pending.push(job)
        this.#pending.sort((a, b) => b.priority - a.priority || a.nextRunAt - b.nextRunAt)
      }
    } finally {
      this.#processing.delete(job.id)
    }
  }

  async drain() {
    if (this.#running) return
    this.#running = true
    while (this.#pending.length > 0) {
      const now = Date.now()
      const idx = this.#pending.findIndex(j => j.nextRunAt <= now)
      if (idx === -1) break
      const [job] = this.#pending.splice(idx, 1)
      await this.#executeJob(job)
    }
    this.#running = false
  }

  status() {
    return {
      pending:    this.#pending.length,
      processing: this.#processing.size,
      deadLetter: this.#deadLetter.length,
    }
  }

  deadLetterQueue() { return [...this.#deadLetter] }
  clearSeen()       { this.#seen.clear() }
}

export const queue = new WorkQueue()
export { makeIdempotencyKey }
