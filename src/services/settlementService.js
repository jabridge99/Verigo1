import { bus } from '../lib/eventBus.js'
import { queue, JOB_TYPES, makeIdempotencyKey } from '../lib/queue.js'
import { can, RbacError } from '../lib/rbac.js'
import { audit, AUDIT_ACTIONS } from '../lib/audit.js'

export const PLATFORM_FEE_PCT    = 5
export const MIN_SETTLEMENT_DAYS = 1
export const MAX_SETTLEMENT_DAYS = 7

// In-memory state
const batches          = new Map()   // batchId → record
const batchPeriodIndex = new Map()   // `${operatorId}:${periodStart}:${periodEnd}` → batchId
const ledgerSnapshot   = new Map()   // batchId → [ledger entries] (mock)

function buildBatchId(operatorId, periodStart, periodEnd) {
  const start = new Date(periodStart).toISOString().slice(0, 10)
  const end   = new Date(periodEnd).toISOString().slice(0, 10)
  return `BATCH_${operatorId.slice(0, 8).toUpperCase()}_${start}_${end}`
}

function validatePeriod(periodStart, periodEnd) {
  const start = new Date(periodStart)
  const end   = new Date(periodEnd)
  if (isNaN(start.getTime())) throw new Error('periodStart is not a valid date')
  if (isNaN(end.getTime()))   throw new Error('periodEnd is not a valid date')
  if (end <= start)            throw new Error('periodEnd must be after periodStart')

  const diffDays = (end - start) / (1_000 * 60 * 60 * 24)
  if (diffDays < MIN_SETTLEMENT_DAYS) throw new Error(`Settlement period must be at least ${MIN_SETTLEMENT_DAYS} day(s)`)
  if (diffDays > MAX_SETTLEMENT_DAYS) throw new Error(`Settlement period cannot exceed ${MAX_SETTLEMENT_DAYS} days`)

  return { start, end, diffDays }
}

function mockGrossCalculation(operatorId, periodStart, periodEnd) {
  // Stub: in production this queries approved deposits in the period for this operator
  const seed      = operatorId.charCodeAt(0) + new Date(periodStart).getDate()
  const grossAud  = parseFloat(((seed % 50 + 10) * 100 + Math.random() * 500).toFixed(2))
  const entries   = Array.from({ length: Math.floor(grossAud / 25) }, (_, i) => ({
    id:         crypto.randomUUID(),
    depositId:  crypto.randomUUID(),
    amountAud:  parseFloat((grossAud / Math.ceil(grossAud / 25)).toFixed(2)),
    sequence:   i + 1,
  }))
  return { grossAud, entries }
}

export async function createBatch(operatorId, periodStart, periodEnd, { actor, context } = {}) {
  if (!can(context?.role, 'write:settlement')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'write:settlement'`, 'write:settlement')
  }
  if (!operatorId) throw new Error('operatorId is required')
  validatePeriod(periodStart, periodEnd)

  const periodKey = `${operatorId}:${periodStart}:${periodEnd}`
  if (batchPeriodIndex.has(periodKey)) {
    const existing = batches.get(batchPeriodIndex.get(periodKey))
    return { batchId: existing.batchId, status: existing.status, idempotent: true }
  }

  const { grossAud, entries } = mockGrossCalculation(operatorId, periodStart, periodEnd)
  const feeAud    = parseFloat((grossAud * (PLATFORM_FEE_PCT / 100)).toFixed(2))
  const netAud    = parseFloat((grossAud - feeAud).toFixed(2))
  const batchId   = buildBatchId(operatorId, periodStart, periodEnd)
  const now       = new Date().toISOString()

  const record = {
    id:          crypto.randomUUID(),
    operatorId,
    batchId,
    periodStart: new Date(periodStart).toISOString(),
    periodEnd:   new Date(periodEnd).toISOString(),
    grossAud,
    feeAud,
    netAud,
    status:      'pending',
    processedAt: null,
    createdAt:   now,
    updatedAt:   now,
    createdBy:   actor,
  }

  batches.set(batchId, record)
  batchPeriodIndex.set(periodKey, batchId)
  ledgerSnapshot.set(batchId, entries)

  queue.enqueue(JOB_TYPES.SETTLEMENT_BATCH, { batchId, operatorId, netAud }, {
    idempotencyKey: makeIdempotencyKey(JOB_TYPES.SETTLEMENT_BATCH, batchId),
  })

  await audit(AUDIT_ACTIONS.SETTLEMENT_CREATED, {
    actor,
    entityId:   batchId,
    entityType: 'settlement',
    after:      { operatorId, batchId, grossAud, feeAud, netAud, status: 'pending', periodStart, periodEnd },
    meta:       { context },
  })

  bus.publish('settlement.batch.created', { batchId, operatorId, grossAud, netAud, periodStart, periodEnd })

  return { batchId, status: 'pending', grossAud, feeAud, netAud, periodStart, periodEnd }
}

export async function approveBatch(batchId, { actor, context } = {}) {
  if (!can(context?.role, 'approve:settlement')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'approve:settlement'`, 'approve:settlement')
  }

  const batch = batches.get(batchId)
  if (!batch) throw new Error(`Settlement batch not found: ${batchId}`)
  if (batch.status !== 'pending') throw new Error(`Batch ${batchId} has status '${batch.status}' — can only approve pending batches`)

  // Check for held fraud cases on the operator
  const { getActiveCaseForEntity } = await import('./fraudService.js')
  const activeCase = getActiveCaseForEntity(batch.operatorId, 'operator')
  if (activeCase && activeCase.status === 'open') {
    throw new Error(`Cannot approve settlement — operator ${batch.operatorId} has an open fraud case (${activeCase.id})`)
  }

  const { consistent, discrepancies } = await reconcile(batchId)
  if (!consistent) {
    throw new Error(`Cannot approve batch ${batchId} — reconciliation failed: ${discrepancies.length} discrepancy/ies found`)
  }

  const before     = { status: batch.status }
  const now        = new Date().toISOString()
  batch.status     = 'approved'
  batch.approvedBy  = actor
  batch.approvedAt  = now
  batch.updatedAt   = now

  await audit(AUDIT_ACTIONS.SETTLEMENT_APPROVED, {
    actor,
    entityId:   batchId,
    entityType: 'settlement',
    before,
    after:      { status: 'approved', approvedBy: actor, approvedAt: now },
    meta:       { context },
  })

  bus.publish('settlement.batch.processed', { batchId, operatorId: batch.operatorId, netAud: batch.netAud, actor })

  return { batchId, status: 'approved' }
}

export async function holdBatch(batchId, reason, { actor, context } = {}) {
  if (!can(context?.role, 'approve:settlement')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'approve:settlement'`, 'approve:settlement')
  }
  if (!reason) throw new Error('reason is required to hold a batch')

  const batch = batches.get(batchId)
  if (!batch) throw new Error(`Settlement batch not found: ${batchId}`)
  if (batch.status === 'completed') throw new Error(`Cannot hold a completed settlement batch`)

  const before      = { status: batch.status }
  const now         = new Date().toISOString()
  batch.status      = 'held'
  batch.holdReason  = reason
  batch.heldAt      = now
  batch.updatedAt   = now

  await audit(AUDIT_ACTIONS.SETTLEMENT_HELD, {
    actor,
    entityId:   batchId,
    entityType: 'settlement',
    before,
    after:      { status: 'held', holdReason: reason, heldAt: now },
    meta:       { reason, context },
  })

  bus.publish('settlement.batch.failed', { batchId, operatorId: batch.operatorId, reason, actor })

  return { batchId, status: 'held', reason }
}

export async function reconcile(batchId) {
  const batch = batches.get(batchId)
  if (!batch) throw new Error(`Settlement batch not found: ${batchId}`)

  const entries      = ledgerSnapshot.get(batchId) ?? []
  const discrepancies = []

  // Sum ledger entries and compare to batch gross
  const ledgerSum = parseFloat(
    entries.reduce((sum, e) => sum + e.amountAud, 0).toFixed(2)
  )

  if (Math.abs(ledgerSum - batch.grossAud) > 0.01) {
    discrepancies.push({
      type:     'gross_mismatch',
      expected: batch.grossAud,
      actual:   ledgerSum,
      delta:    parseFloat((ledgerSum - batch.grossAud).toFixed(2)),
    })
  }

  // Check for duplicate deposit references
  const seen    = new Set()
  const dupeIds = []
  for (const entry of entries) {
    if (seen.has(entry.depositId)) {
      dupeIds.push(entry.depositId)
    }
    seen.add(entry.depositId)
  }
  if (dupeIds.length > 0) {
    discrepancies.push({ type: 'duplicate_deposit', depositIds: dupeIds })
  }

  // Check fee calculation integrity
  const expectedFee = parseFloat((batch.grossAud * (PLATFORM_FEE_PCT / 100)).toFixed(2))
  if (Math.abs(expectedFee - batch.feeAud) > 0.01) {
    discrepancies.push({
      type:     'fee_mismatch',
      expected: expectedFee,
      actual:   batch.feeAud,
      delta:    parseFloat((batch.feeAud - expectedFee).toFixed(2)),
    })
  }

  const consistent = discrepancies.length === 0

  if (!consistent) {
    bus.publish('platform.audit.inconsistency', { batchId, discrepancies })
  }

  return {
    consistent,
    discrepancies,
    ledgerSum,
    batchGross: batch.grossAud,
    entryCount: entries.length,
    checkedAt:  new Date().toISOString(),
  }
}

export function getBatch(batchId) {
  return batches.get(batchId) ?? null
}

export function getBatchesForOperator(operatorId) {
  return [...batches.values()].filter(b => b.operatorId === operatorId)
}
