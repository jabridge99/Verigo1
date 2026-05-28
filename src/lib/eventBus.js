// Event-driven pub/sub bus — all platform events flow through here

const VALID_EVENTS = new Set([
  // Deposit lifecycle
  'deposit.created', 'deposit.flagged', 'deposit.approved', 'deposit.rejected',
  // Payout lifecycle
  'payout.requested', 'payout.held', 'payout.approved', 'payout.released', 'payout.rejected',
  // Fraud signals
  'fraud.signal.raised', 'fraud.case.opened', 'fraud.case.resolved', 'fraud.entity.suspended',
  // Pricing
  'pricing.updated', 'pricing.override.applied', 'pricing.shadow.diverged',
  // Settlement
  'settlement.batch.created', 'settlement.batch.processed', 'settlement.batch.failed',
  // Operations
  'station.online', 'station.offline', 'pickup.assigned', 'pickup.completed',
  // Marketplace
  'marketplace.redemption.completed', 'marketplace.offer.expired',
  // Platform
  'platform.health.degraded', 'platform.audit.inconsistency',
])

class EventBus {
  #handlers = new Map()
  #history = []
  #maxHistory = 500

  subscribe(event, handler) {
    if (!VALID_EVENTS.has(event)) throw new Error(`Unknown event: ${event}`)
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set())
    this.#handlers.get(event).add(handler)
    return () => this.#handlers.get(event)?.delete(handler)
  }

  publish(event, payload = {}) {
    if (!VALID_EVENTS.has(event)) throw new Error(`Unknown event: ${event}`)
    const entry = { event, payload, ts: new Date().toISOString(), id: crypto.randomUUID() }
    this.#history.push(entry)
    if (this.#history.length > this.#maxHistory) this.#history.shift()
    this.#handlers.get(event)?.forEach(fn => {
      try { fn(payload, entry) }
      catch (err) { console.error(`[EventBus] Handler error on ${event}:`, err) }
    })
    return entry.id
  }

  history(event = null) {
    return event ? this.#history.filter(e => e.event === event) : [...this.#history]
  }

  clearHistory() { this.#history = [] }
}

export const bus = new EventBus()
export { VALID_EVENTS }
