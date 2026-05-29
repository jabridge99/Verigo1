// Pricing override approval queue
// Manages trader-submitted rate override requests through pending → approved/rejected lifecycle.

import { pricingEngine } from './pricingEngine'
import { marketFeed } from './marketFeed'
import { bus } from './eventBus'
import { audit, AUDIT_ACTIONS } from './audit'

let _seq = 0

class OverrideQueue {
  #queue = []   // Array<OverrideRequest>

  submit(material, proposedRatePerKg, rationale, trader = 'trader') {
    const price       = marketFeed.getPrice(material)
    const currentRate = price?.consumer_rate ?? 0
    const id = `OVR-${String(++_seq).padStart(5, '0')}`
    const request = {
      id,
      material,
      currentRate,
      proposedRate: proposedRatePerKg,
      rationale:    rationale || '',
      trader,
      status:      'pending',
      createdAt:    new Date().toISOString(),
      resolvedAt:   null,
      approver:     null,
      rejectReason: null,
    }
    this.#queue.push(request)
    bus.publish('override.queue.submitted', { id, material, proposedRatePerKg, trader })
    return id
  }

  approve(requestId, approver = 'approver') {
    const req = this.#queue.find(r => r.id === requestId)
    if (!req || req.status !== 'pending') throw new Error(`Request ${requestId} not pending`)
    req.status     = 'approved'
    req.approver   = approver
    req.resolvedAt = new Date().toISOString()
    pricingEngine.applyOverride(req.material, req.proposedRate, approver)
    void audit(AUDIT_ACTIONS.PRICE_OVERRIDE_APPLIED, {
      actor: approver, entityId: requestId,
      after: { material: req.material, rate: req.proposedRate, requestId },
    })
    bus.publish('override.queue.approved', { id: requestId, material: req.material, approver })
    return req
  }

  reject(requestId, approver = 'approver', reason = '') {
    const req = this.#queue.find(r => r.id === requestId)
    if (!req || req.status !== 'pending') throw new Error(`Request ${requestId} not pending`)
    req.status       = 'rejected'
    req.approver     = approver
    req.rejectReason = reason
    req.resolvedAt   = new Date().toISOString()
    void audit(AUDIT_ACTIONS.PRICE_OVERRIDE_CLEARED, {
      actor: approver, entityId: requestId,
      after: { material: req.material, reason, requestId },
    })
    bus.publish('override.queue.rejected', { id: requestId, material: req.material, approver, reason })
    return req
  }

  getQueue(status = null) {
    if (!status) return [...this.#queue]
    return this.#queue.filter(r => r.status === status)
  }

  get pendingCount() { return this.#queue.filter(r => r.status === 'pending').length }
}

export const overrideQueue = new OverrideQueue()
