import { bus } from '../lib/eventBus.js'
import { queue, JOB_TYPES, makeIdempotencyKey } from '../lib/queue.js'
import { can, requirePermission, ROLES, RbacError } from '../lib/rbac.js'
import { audit, AUDIT_ACTIONS } from '../lib/audit.js'
import { generateIdempotencyKey } from '../lib/crypto.js'

export const PTS_TO_AUD                = 0.05
export const LARGE_PAYOUT_THRESHOLD_AUD = 500
export const PAYOUT_ABUSE_WINDOW_MS    = 48 * 60 * 60 * 1000
export const PAYOUT_ABUSE_LIMIT        = 5

// In-memory state (replaces DB in this service layer)
const payouts         = new Map()   // payoutId → record
const idempotencyMap  = new Map()   // idempotencyKey → payoutId
const userPayoutTimes = new Map()   // userId → [timestamp, ...]
const fraudCaseIndex  = new Set()   // userIds with active fraud cases (seeded by fraudService)

// Called by fraudService when a case is opened/resolved
export function _setActiveFraudCase(userId, active) {
  if (active) fraudCaseIndex.add(userId)
  else fraudCaseIndex.delete(userId)
}

function getUser(userId) {
  // Stub — in production this queries the users table
  if (!userId || typeof userId !== 'string') return null
  return { id: userId, exists: true }
}

function recordPayoutTimestamp(userId) {
  const times = userPayoutTimes.get(userId) ?? []
  times.push(Date.now())
  userPayoutTimes.set(userId, times)
}

function recentPayoutCount(userId) {
  const cutoff = Date.now() - PAYOUT_ABUSE_WINDOW_MS
  const times  = (userPayoutTimes.get(userId) ?? []).filter(t => t > cutoff)
  userPayoutTimes.set(userId, times)
  return times.length
}

export async function requestPayout(userId, amountPts, { bankRef, idempotencyKey } = {}) {
  if (!userId)          throw new Error('userId is required')
  if (!Number.isInteger(amountPts) || amountPts <= 0) throw new Error('amountPts must be a positive integer')

  const user = getUser(userId)
  if (!user) throw new Error(`User not found: ${userId}`)

  const amountAud    = amountPts * PTS_TO_AUD
  const iKey         = idempotencyKey ?? generateIdempotencyKey('payout', userId, String(amountPts))

  if (idempotencyMap.has(iKey)) {
    const existing = payouts.get(idempotencyMap.get(iKey))
    return { requestId: existing.id, status: existing.status, reason: existing.holdReason, idempotent: true, estimatedProcessingHours: existing.estimatedProcessingHours }
  }

  let status       = 'pending'
  let holdReason   = null

  if (amountAud > LARGE_PAYOUT_THRESHOLD_AUD) {
    status     = 'held'
    holdReason = `Payout exceeds large-payout threshold of AUD ${LARGE_PAYOUT_THRESHOLD_AUD}`
  } else if (fraudCaseIndex.has(userId)) {
    status     = 'held'
    holdReason = 'Active fraud case on account'
  } else if (recentPayoutCount(userId) >= PAYOUT_ABUSE_LIMIT) {
    status     = 'held'
    holdReason = `More than ${PAYOUT_ABUSE_LIMIT} payouts in ${PAYOUT_ABUSE_WINDOW_MS / 3_600_000}h window`
  }

  const estimatedProcessingHours = status === 'held' ? 72 : 24

  const payoutId = crypto.randomUUID()
  const record   = {
    id:                    payoutId,
    userId,
    amountPts,
    amountAud,
    status,
    holdReason,
    idempotencyKey:        iKey,
    bankRef:               bankRef ?? null,
    createdAt:             new Date().toISOString(),
    updatedAt:             new Date().toISOString(),
    estimatedProcessingHours,
  }

  payouts.set(payoutId, record)
  idempotencyMap.set(iKey, payoutId)
  recordPayoutTimestamp(userId)

  queue.enqueue(JOB_TYPES.PAYOUT_PROCESS, { payoutId, userId, amountPts, amountAud }, {
    idempotencyKey: makeIdempotencyKey(JOB_TYPES.PAYOUT_PROCESS, payoutId),
  })

  await audit(AUDIT_ACTIONS.PAYOUT_REQUESTED, {
    actor:      userId,
    entityId:   payoutId,
    entityType: 'payout_request',
    after:      { status, amountPts, amountAud, holdReason },
  })

  bus.publish('payout.requested', { payoutId, userId, amountPts, amountAud, status, holdReason })

  return { requestId: payoutId, status, reason: holdReason, estimatedProcessingHours }
}

export async function holdPayout(payoutId, reason, { actor, context } = {}) {
  if (!can(context?.role, 'hold:payout')) throw new RbacError(`Role '${context?.role}' lacks permission 'hold:payout'`, 'hold:payout')

  const payout = payouts.get(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)

  const before = { ...payout }
  payout.status    = 'held'
  payout.holdReason = reason
  payout.heldAt    = new Date().toISOString()
  payout.updatedAt = new Date().toISOString()

  await audit(AUDIT_ACTIONS.PAYOUT_HELD, {
    actor,
    entityId:   payoutId,
    entityType: 'payout_request',
    before:     { status: before.status, holdReason: before.holdReason },
    after:      { status: payout.status, holdReason: payout.holdReason },
    meta:       { reason },
  })

  bus.publish('payout.held', { payoutId, userId: payout.userId, reason, actor })

  return { payoutId, status: payout.status }
}

export async function approvePayout(payoutId, { actor, context } = {}) {
  if (!can(context?.role, 'approve:payout')) throw new RbacError(`Role '${context?.role}' lacks permission 'approve:payout'`, 'approve:payout')

  const payout = payouts.get(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (!['held', 'pending'].includes(payout.status)) throw new Error(`Payout ${payoutId} has status '${payout.status}' — can only approve held or pending payouts`)

  const before = { status: payout.status }
  payout.status     = 'approved'
  payout.approvedBy  = actor
  payout.approvedAt  = new Date().toISOString()
  payout.updatedAt   = new Date().toISOString()

  await audit(AUDIT_ACTIONS.PAYOUT_APPROVED, {
    actor,
    entityId:   payoutId,
    entityType: 'payout_request',
    before,
    after:      { status: payout.status, approvedBy: actor },
  })

  bus.publish('payout.approved', { payoutId, userId: payout.userId, amountAud: payout.amountAud, actor })

  return { payoutId, status: payout.status }
}

export async function releasePayout(payoutId, { actor, context } = {}) {
  if (!can(context?.role, 'release:payout')) throw new RbacError(`Role '${context?.role}' lacks permission 'release:payout'`, 'release:payout')

  const payout = payouts.get(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status !== 'approved') throw new Error(`Payout ${payoutId} must be approved before it can be released (current: '${payout.status}')`)

  const before = { status: payout.status }
  payout.status     = 'released'
  payout.releasedAt = new Date().toISOString()
  payout.updatedAt  = new Date().toISOString()

  await audit(AUDIT_ACTIONS.PAYOUT_RELEASED, {
    actor,
    entityId:   payoutId,
    entityType: 'payout_request',
    before,
    after:      { status: payout.status, releasedAt: payout.releasedAt },
  })

  bus.publish('payout.released', { payoutId, userId: payout.userId, amountAud: payout.amountAud, actor })

  return { payoutId, status: payout.status }
}

export async function rejectPayout(payoutId, reason, { actor, context } = {}) {
  if (!can(context?.role, 'approve:payout')) throw new RbacError(`Role '${context?.role}' lacks permission 'approve:payout'`, 'approve:payout')
  if (!reason) throw new Error('reason is required when rejecting a payout')

  const payout = payouts.get(payoutId)
  if (!payout) throw new Error(`Payout not found: ${payoutId}`)
  if (payout.status === 'released') throw new Error(`Cannot reject a payout that has already been released`)

  const before = { status: payout.status }
  payout.status          = 'rejected'
  payout.rejectionReason = reason
  payout.rejectedAt      = new Date().toISOString()
  payout.updatedAt       = new Date().toISOString()

  await audit(AUDIT_ACTIONS.PAYOUT_REJECTED, {
    actor,
    entityId:   payoutId,
    entityType: 'payout_request',
    before,
    after:      { status: payout.status, rejectionReason: reason },
    meta:       { reason },
  })

  bus.publish('payout.rejected', { payoutId, userId: payout.userId, reason, actor })

  return { payoutId, status: payout.status }
}

// Read helpers (no auth required — callers must gate access)
export function getPayout(payoutId) {
  return payouts.get(payoutId) ?? null
}

export function getPayoutsForUser(userId) {
  return [...payouts.values()].filter(p => p.userId === userId)
}
