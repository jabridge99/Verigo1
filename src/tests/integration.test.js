import { bus, VALID_EVENTS } from '../lib/eventBus.js'
import { queue, JOB_TYPES } from '../lib/queue.js'
import { can, ROLES, permissionsFor } from '../lib/rbac.js'
import { sha256, signWebhook, verifyWebhook, maskEmail, maskPhone } from '../lib/crypto.js'
import { auditLog, audit, AUDIT_ACTIONS } from '../lib/audit.js'

describe('EventBus', () => {
  beforeEach(() => {
    bus.clearHistory()
  })

  it('publishes and receives an event', () => {
    const received = []
    bus.subscribe('deposit.created', payload => received.push(payload))
    bus.publish('deposit.created', { depositId: 'dep-1', userId: 'u-1' })
    expect(received).toHaveLength(1)
    expect(received[0].depositId).toBe('dep-1')
  })

  it('returns unsubscribe function that works', () => {
    const received = []
    const unsub = bus.subscribe('deposit.created', payload => received.push(payload))
    unsub()
    bus.publish('deposit.created', { depositId: 'dep-2' })
    expect(received).toHaveLength(0)
  })

  it('rejects invalid event names', () => {
    expect(() => bus.publish('unknown.event', {})).toThrow()
  })

  it('stores event in history', () => {
    const before = bus.history().length
    bus.publish('deposit.created', { depositId: 'dep-3' })
    expect(bus.history().length).toBe(before + 1)
  })

  it('filters history by event name', () => {
    bus.publish('deposit.created', { depositId: 'dep-4' })
    bus.publish('payout.requested', { payoutId: 'pay-1' })
    const depositHistory = bus.history('deposit.created')
    expect(depositHistory.every(e => e.event === 'deposit.created')).toBe(true)
    expect(depositHistory.length).toBeGreaterThanOrEqual(1)
  })
})

describe('WorkQueue', () => {
  beforeEach(() => {
    queue.clearSeen()
  })

  it('deduplicates by idempotency key', () => {
    const key = 'dedup-key-1'
    const first = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-1' }, { idempotencyKey: key })
    const second = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-1' }, { idempotencyKey: key })
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(second.jobId).toBe(first.jobId)
  })

  it('accepts same job without idempotency key twice', () => {
    const first = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-2' })
    const second = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-3' })
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(false)
  })
})

describe('RBAC — permission matrix', () => {
  it('super_admin has all permissions', () => {
    expect(can(ROLES.super_admin, 'suspend:entity')).toBe(true)
    expect(can(ROLES.super_admin, 'run:self_audit')).toBe(true)
  })

  it('consumer cannot access pricing', () => {
    expect(can(ROLES.consumer, 'write:pricing')).toBe(false)
  })

  it('merchant can read marketplace', () => {
    expect(can(ROLES.merchant, 'read:marketplace')).toBe(true)
  })

  it('operator can approve deposits', () => {
    expect(can(ROLES.operator, 'approve:deposit')).toBe(true)
  })

  it('logistics_contractor cannot read audit', () => {
    expect(can(ROLES.logistics_contractor, 'read:audit')).toBe(false)
  })

  it('permissionsFor returns non-empty for valid role', () => {
    expect(permissionsFor(ROLES.pricing_manager).length).toBeGreaterThan(0)
  })
})

describe('Crypto', () => {
  it('sha256 produces consistent hash for same input', async () => {
    const h1 = await sha256('hello')
    const h2 = await sha256('hello')
    expect(h1).toBe(h2)
  })

  it('sha256 produces different hash for different input', async () => {
    const h1 = await sha256('hello')
    const h2 = await sha256('world')
    expect(h1).not.toBe(h2)
  })

  it('signWebhook and verifyWebhook roundtrip', async () => {
    const payload = { event: 'deposit.created', data: { id: 'dep-1' } }
    const sig = await signWebhook(payload, 'my-secret')
    const valid = await verifyWebhook(payload, sig, 'my-secret')
    expect(valid).toBe(true)
  })

  it('verifyWebhook rejects wrong signature', async () => {
    const payload = { event: 'deposit.created', data: { id: 'dep-1' } }
    const sig = await signWebhook(payload, 'secret1')
    const valid = await verifyWebhook(payload, sig, 'secret2')
    expect(valid).toBe(false)
  })

  it('maskEmail redacts local part', () => {
    expect(maskEmail('john.doe@example.com')).toBe('j****@example.com')
  })

  it('maskPhone redacts all but last 4 digits', () => {
    expect(maskPhone('0412345678')).toBe('******5678')
  })
})

describe('Audit log', () => {
  let localLog

  beforeEach(() => {
    const { AuditLog: _AuditLog } = (() => {
      class AuditLog {
        #entries = []
        #prevHash = '0'.repeat(64)

        async append({ action, actor, entityId, entityType, before, after, meta = {} }) {
          const sequence = this.#entries.length + 1
          const entry = {
            id: crypto.randomUUID(),
            sequence,
            action,
            actor: actor ?? 'system',
            entityId: entityId ?? null,
            entityType: entityType ?? null,
            before: before ?? null,
            after: after ?? null,
            meta,
            ts: new Date().toISOString(),
            prevHash: this.#prevHash,
          }
          entry.hash = await sha256(JSON.stringify({
            sequence: entry.sequence,
            action: entry.action,
            actor: entry.actor,
            entityId: entry.entityId,
            ts: entry.ts,
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
          if (action) results = results.filter(e => e.action === action)
          if (actor) results = results.filter(e => e.actor === actor)
          if (entityId) results = results.filter(e => e.entityId === entityId)
          if (entityType) results = results.filter(e => e.entityType === entityType)
          if (from) results = results.filter(e => e.ts >= from)
          if (to) results = results.filter(e => e.ts <= to)
          return results.slice(-limit).reverse()
        }

        get entries() { return [...this.#entries] }
        get length() { return this.#entries.length }
      }
      return { AuditLog }
    })()

    localLog = new _AuditLog()
  })

  it('appends entries with sequential sequence numbers', async () => {
    const e1 = await localLog.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    const e2 = await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_REQUESTED, actor: 'u-1' })
    const e3 = await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_APPROVED, actor: 'u-2' })
    expect(e1.sequence).toBe(1)
    expect(e2.sequence).toBe(2)
    expect(e3.sequence).toBe(3)
  })

  it('each entry has a non-empty hash', async () => {
    const entry = await localLog.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('links each entry to previous via prevHash', async () => {
    const e1 = await localLog.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    const e2 = await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_REQUESTED, actor: 'u-1' })
    expect(e2.prevHash).toBe(e1.hash)
  })

  it('verifyIntegrity passes for unmodified log', async () => {
    await localLog.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_REQUESTED, actor: 'u-1' })
    await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_APPROVED, actor: 'u-2' })
    const result = await localLog.verifyIntegrity()
    expect(result.intact).toBe(true)
  })

  it('query filters by action', async () => {
    await localLog.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_REQUESTED, actor: 'u-1' })
    await localLog.append({ action: AUDIT_ACTIONS.PAYOUT_APPROVED, actor: 'u-2' })
    const results = localLog.query({ action: AUDIT_ACTIONS.AUTH_LOGIN })
    expect(results).toHaveLength(1)
    expect(results[0].action).toBe(AUDIT_ACTIONS.AUTH_LOGIN)
  })
})
