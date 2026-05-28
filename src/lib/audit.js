// Immutable append-only audit log with SHA-256 hash chain
// Each entry links to the previous via prevHash — tampering breaks the chain

import { sha256 } from './crypto.js'
import { bus } from './eventBus.js'

export const AUDIT_ACTIONS = {
  // Auth
  AUTH_LOGIN:             'auth.login',
  AUTH_LOGOUT:            'auth.logout',
  AUTH_TOKEN_ISSUED:      'auth.token.issued',
  AUTH_TOKEN_REVOKED:     'auth.token.revoked',
  // Payout
  PAYOUT_REQUESTED:       'payout.requested',
  PAYOUT_HELD:            'payout.held',
  PAYOUT_APPROVED:        'payout.approved',
  PAYOUT_RELEASED:        'payout.released',
  PAYOUT_REJECTED:        'payout.rejected',
  // Fraud
  FRAUD_SIGNAL:           'fraud.signal',
  FRAUD_CASE_OPENED:      'fraud.case.opened',
  FRAUD_ACTION_TAKEN:     'fraud.action.taken',
  FRAUD_ENTITY_SUSPENDED: 'fraud.entity.suspended',
  // Pricing
  PRICE_OVERRIDE:         'pricing.override',
  PRICE_FREEZE:           'pricing.freeze',
  SHADOW_PROMOTED:        'shadow.promoted',
  // Settlement
  SETTLEMENT_CREATED:     'settlement.created',
  SETTLEMENT_APPROVED:    'settlement.approved',
  SETTLEMENT_HELD:        'settlement.held',
  // KYC
  KYC_SUBMITTED:          'kyc.submitted',
  KYC_APPROVED:           'kyc.approved',
  KYC_REJECTED:           'kyc.rejected',
  // System
  CONFIG_CHANGED:         'config.changed',
  RULE_UPDATED:           'rule.updated',
  DATA_EXPORT:            'data.export',
  SELF_AUDIT_RUN:         'self_audit.run',
}

class AuditLog {
  #entries = []
  #prevHash = '0'.repeat(64)   // genesis hash

  async append({ action, actor, entityId, entityType, before, after, meta = {} }) {
    const sequence = this.#entries.length + 1
    const entry = {
      id:         crypto.randomUUID(),
      sequence,
      action,
      actor:      actor ?? 'system',
      entityId:   entityId ?? null,
      entityType: entityType ?? null,
      before:     before ?? null,
      after:      after ?? null,
      meta,
      ts:         new Date().toISOString(),
      prevHash:   this.#prevHash,
    }
    entry.hash = await sha256(JSON.stringify({
      sequence: entry.sequence,
      action:   entry.action,
      actor:    entry.actor,
      entityId: entry.entityId,
      ts:       entry.ts,
      prevHash: entry.prevHash,
    }))
    this.#prevHash = entry.hash
    this.#entries.push(Object.freeze(entry))
    return entry
  }

  async verifyIntegrity() {
    let prevHash = '0'.repeat(64)
    const broken = []
    for (const entry of this.#entries) {
      const expected = await sha256(JSON.stringify({
        sequence: entry.sequence, action: entry.action, actor: entry.actor,
        entityId: entry.entityId, ts: entry.ts, prevHash,
      }))
      if (expected !== entry.hash) broken.push({ id: entry.id, sequence: entry.sequence })
      prevHash = entry.hash
    }
    return { intact: broken.length === 0, broken, total: this.#entries.length }
  }

  query({ action, actor, entityId, entityType, from, to, limit = 100 } = {}) {
    let results = [...this.#entries]
    if (action)     results = results.filter(e => e.action === action)
    if (actor)      results = results.filter(e => e.actor === actor)
    if (entityId)   results = results.filter(e => e.entityId === entityId)
    if (entityType) results = results.filter(e => e.entityType === entityType)
    if (from)       results = results.filter(e => e.ts >= from)
    if (to)         results = results.filter(e => e.ts <= to)
    return results.slice(-limit).reverse()
  }

  exportJSON()  { return JSON.stringify(this.#entries, null, 2) }
  exportCSV()   {
    const cols = ['sequence', 'action', 'actor', 'entityId', 'entityType', 'ts', 'hash']
    const rows = this.#entries.map(e => cols.map(c => JSON.stringify(e[c] ?? '')).join(','))
    return [cols.join(','), ...rows].join('\n')
  }

  get length() { return this.#entries.length }
  get head()   { return this.#entries.at(-1) ?? null }
}

export const auditLog = new AuditLog()

// Convenience wrapper
export async function audit(action, { actor, entityId, entityType, before, after, meta } = {}) {
  return auditLog.append({ action, actor, entityId, entityType, before, after, meta })
}
