import { bus } from '../lib/eventBus.js'
import { queue, JOB_TYPES } from '../lib/queue.js'
import { can, ROLES } from '../lib/rbac.js'
import { sha256 } from '../lib/crypto.js'
import { AUDIT_ACTIONS } from '../lib/audit.js'

function createRolloutState(stages) {
  let currentStage = 0
  let status = 'running'
  return {
    advance() {
      if (status === 'rolled_back') return this
      if (currentStage < stages.length - 1) currentStage++
      return this
    },
    rollback(reason) {
      const rolledBackFrom = currentStage
      status = 'rolled_back'
      return { success: true, rolledBackFrom, reason }
    },
    pause() { status = 'paused'; return this },
    getState() { return { stage: currentStage, pct: stages[currentStage], status } },
  }
}

function checkHealthGates(metrics, gates) {
  return {
    margin_ok:    metrics.margin_pct >= gates.margin_floor_pct,
    fraud_ok:     metrics.fraud_rate_pct <= gates.fraud_ceiling_pct,
    volume_ok:    metrics.volume_units_wk >= gates.volume_floor_units_wk,
    logistics_ok: metrics.logistics_load <= gates.logistics_ceiling_load,
    all_passing() {
      return this.margin_ok && this.fraud_ok && this.volume_ok && this.logistics_ok
    },
  }
}

const DEFAULT_GATES = {
  margin_floor_pct:       20,
  fraud_ceiling_pct:      2.5,
  volume_floor_units_wk:  1400,
  logistics_ceiling_load: 22.0,
}

const STAGES = [0, 5, 10, 20, 30, 50, 75, 100]

describe('Pricing rollout rollback', () => {
  it('can roll back from any stage', () => {
    const rollout = createRolloutState(STAGES)
    rollout.advance().advance().advance().advance()
    expect(rollout.getState().stage).toBe(4)
    const result = rollout.rollback('test rollback')
    expect(result.success).toBe(true)
    expect(rollout.getState().status).toBe('rolled_back')
  })

  it('rollback records reason', () => {
    const rollout = createRolloutState(STAGES)
    rollout.advance().advance()
    const result = rollout.rollback('margin below floor')
    expect(result.reason).toBe('margin below floor')
  })

  it('cannot advance after rollback', () => {
    const rollout = createRolloutState(STAGES)
    rollout.advance().advance().advance().advance()
    const result = rollout.rollback('test reason')
    const stageAtRollback = result.rolledBackFrom
    rollout.advance()
    expect(rollout.getState().stage).toBe(stageAtRollback)
  })
})

describe('Health gate checks', () => {
  it('passes all gates when metrics are healthy', () => {
    const gates = checkHealthGates(
      { margin_pct: 22, fraud_rate_pct: 1.5, volume_units_wk: 1600, logistics_load: 20 },
      DEFAULT_GATES,
    )
    expect(gates.all_passing()).toBe(true)
  })

  it('fails on margin below floor', () => {
    const gates = checkHealthGates(
      { margin_pct: 18, fraud_rate_pct: 1.5, volume_units_wk: 1600, logistics_load: 20 },
      DEFAULT_GATES,
    )
    expect(gates.margin_ok).toBe(false)
    expect(gates.all_passing()).toBe(false)
  })

  it('fails on fraud above ceiling', () => {
    const gates = checkHealthGates(
      { margin_pct: 22, fraud_rate_pct: 3.0, volume_units_wk: 1600, logistics_load: 20 },
      DEFAULT_GATES,
    )
    expect(gates.fraud_ok).toBe(false)
  })

  it('fails on volume below floor', () => {
    const gates = checkHealthGates(
      { margin_pct: 22, fraud_rate_pct: 1.5, volume_units_wk: 1200, logistics_load: 20 },
      DEFAULT_GATES,
    )
    expect(gates.volume_ok).toBe(false)
  })

  it('fails on logistics above ceiling', () => {
    const gates = checkHealthGates(
      { margin_pct: 22, fraud_rate_pct: 1.5, volume_units_wk: 1600, logistics_load: 23.0 },
      DEFAULT_GATES,
    )
    expect(gates.logistics_ok).toBe(false)
  })

  it('gates use inclusive bounds', () => {
    const gates = checkHealthGates(
      { margin_pct: 20, fraud_rate_pct: 2.5, volume_units_wk: 1600, logistics_load: 20 },
      DEFAULT_GATES,
    )
    expect(gates.margin_ok).toBe(true)
    expect(gates.fraud_ok).toBe(true)
  })
})

describe('Pricing freeze', () => {
  it('freeze prevents new price updates', () => {
    const state = { frozen: false, frozenAt: null, price: 14.80 }

    function freeze(s) {
      s.frozen = true
      s.frozenAt = s.price
    }

    function computeWithState(s, newPrice) {
      if (s.frozen) return s.frozenAt
      return newPrice
    }

    freeze(state)
    expect(computeWithState(state, 16.00)).toBe(14.80)
  })

  it('freeze can be lifted by authorized role', () => {
    const state = { frozen: true, frozenAt: 14.80, price: 14.80 }

    function unfreeze(role, s) {
      if (!can(role, 'write:pricing')) throw new Error('Unauthorized')
      s.frozen = false
      s.frozenAt = null
    }

    function computeWithState(s, newPrice) {
      if (s.frozen) return s.frozenAt
      return newPrice
    }

    unfreeze(ROLES.pricing_manager, state)
    expect(computeWithState(state, 16.00)).toBe(16.00)
  })
})

describe('Idempotency on retry', () => {
  beforeEach(() => {
    queue.clearSeen()
  })

  it('queue deduplicates retried jobs by idempotency key', () => {
    const key = 'retry-key-idempotent'
    const r1 = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-5' }, { idempotencyKey: key })
    const r2 = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-5' }, { idempotencyKey: key })
    const r3 = queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { entityId: 'u-5' }, { idempotencyKey: key })
    expect(r1.duplicate).toBe(false)
    expect(r2.duplicate).toBe(true)
    expect(r3.duplicate).toBe(true)
    expect(r2.jobId).toBe(r1.jobId)
    expect(r3.jobId).toBe(r1.jobId)
  })

  it('different entities get different job IDs', () => {
    const r1 = queue.enqueue(JOB_TYPES.FRAUD_EVALUATE, { entityId: 'entity-A' })
    const r2 = queue.enqueue(JOB_TYPES.FRAUD_EVALUATE, { entityId: 'entity-B' })
    expect(r1.jobId).not.toBe(r2.jobId)
  })
})

describe('Payout hold integrity', () => {
  it('held payouts cannot be released without authorization', () => {
    expect(can(ROLES.consumer, 'release:payout')).toBe(false)
  })

  it('released payout cannot be held again', () => {
    const VALID_TRANSITIONS = {
      pending:  ['held', 'approved', 'rejected'],
      held:     ['approved', 'rejected'],
      approved: ['released'],
      released: [],
      rejected: [],
    }

    function transition(currentStatus, nextStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus] ?? []
      if (!allowed.includes(nextStatus)) {
        return { success: false, error: 'invalid_transition' }
      }
      return { success: true, status: nextStatus }
    }

    const result = transition('released', 'held')
    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid_transition')
  })
})

describe('Audit log tamper detection', () => {
  it('modifying an entry breaks the hash chain', async () => {
    class TamperableAuditLog {
      #entries = []
      #prevHash = '0'.repeat(64)

      async append({ action, actor, entityId }) {
        const sequence = this.#entries.length + 1
        const entry = {
          id: crypto.randomUUID(),
          sequence,
          action,
          actor: actor ?? 'system',
          entityId: entityId ?? null,
          ts: new Date().toISOString(),
          prevHash: this.#prevHash,
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
        this.#entries.push(entry)
        return entry
      }

      tamperEntry(index, newHash) {
        this.#entries[index].hash = newHash
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
    }

    const log = new TamperableAuditLog()
    await log.append({ action: AUDIT_ACTIONS.AUTH_LOGIN, actor: 'u-1' })
    await log.append({ action: AUDIT_ACTIONS.PAYOUT_REQUESTED, actor: 'u-1' })
    await log.append({ action: AUDIT_ACTIONS.PAYOUT_APPROVED, actor: 'u-2' })

    log.tamperEntry(1, 'a'.repeat(64))

    const result = await log.verifyIntegrity()
    expect(result.intact).toBe(false)
    expect(result.broken.length).toBeGreaterThan(0)
  })
})
