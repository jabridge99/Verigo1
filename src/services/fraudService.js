import { bus } from '../lib/eventBus.js'
import { audit, AUDIT_ACTIONS } from '../lib/audit.js'
import { can, RbacError } from '../lib/rbac.js'
import { _setActiveFraudCase } from './payoutService.js'

export const SIGNAL_WEIGHTS = {
  duplicate_scan:      18,
  fake_deposit:        25,
  abnormal_weight:     20,
  gps_mismatch:        15,
  referral_abuse:      22,
  payout_abuse:        20,
  suspicious_operator: 30,
}

export const SIGNAL_THRESHOLDS = {
  duplicate_scan:      { field: 'scan_count',             limit: 2,  window: 'window_hrs' },
  fake_deposit:        { field: 'deviation_pct',           limit: 40 },
  abnormal_weight:     { field: 'sigma_deviation',         limit: 3 },
  gps_mismatch:        { field: 'distance_m',              limit: 200 },
  referral_abuse:      { field: 'referral_count',          limit: 8,  window: '7d' },
  payout_abuse:        { field: 'payout_count',            limit: 5,  window: '48h' },
  suspicious_operator: { field: 'anomaly_approval_pct',    limit: 80 },
}

export const RISK_LEVEL_THRESHOLDS = { low: 25, medium: 50, high: 75 }

// In-memory state
const signals    = new Map()  // signalId → record
const cases      = new Map()  // caseId → record
const actions    = new Map()  // actionId → record
const entityCaseIndex = new Map()  // `${entityId}:${entityType}` → caseId

function ruleId(signalType) {
  return `RULE_${signalType.toUpperCase()}_V1`
}

function severityFromScore(score) {
  if (score >= RISK_LEVEL_THRESHOLDS.high)   return 'critical'
  if (score >= RISK_LEVEL_THRESHOLDS.medium) return 'high'
  if (score >= RISK_LEVEL_THRESHOLDS.low)    return 'medium'
  return 'low'
}

export function evaluateSignal(signalType, entityId, entityType, evidence) {
  if (!SIGNAL_WEIGHTS[signalType]) throw new Error(`Unknown signal type: ${signalType}`)

  let triggered = false

  switch (signalType) {
    case 'duplicate_scan':
      triggered = (evidence.scan_count ?? 0) > 2
      break
    case 'fake_deposit':
      triggered = (evidence.deviation_pct ?? 0) > 40
      break
    case 'abnormal_weight':
      triggered = (evidence.sigma_deviation ?? 0) > 3
      break
    case 'gps_mismatch':
      triggered = (evidence.distance_m ?? 0) > 200
      break
    case 'referral_abuse':
      triggered = (evidence.referral_count ?? 0) > 8
      break
    case 'payout_abuse':
      triggered = (evidence.payout_count ?? 0) > 5
      break
    case 'suspicious_operator':
      triggered = (evidence.anomaly_approval_pct ?? 0) > 80
      break
    default:
      triggered = false
  }

  const score_contribution = triggered ? SIGNAL_WEIGHTS[signalType] : 0
  const severity           = triggered ? severityFromScore(score_contribution) : 'low'

  return { triggered, severity, score_contribution, rule_id: ruleId(signalType) }
}

export function calculateRiskScore(signals) {
  if (!Array.isArray(signals)) throw new Error('signals must be an array of evaluateSignal results')
  const raw = signals
    .filter(s => s.triggered)
    .reduce((sum, s) => sum + s.score_contribution, 0)
  return Math.min(100, raw)
}

export async function openCase(entityId, entityType, primarySignal, { actor } = {}) {
  if (!entityId)      throw new Error('entityId is required')
  if (!entityType)    throw new Error('entityType is required')
  if (!primarySignal) throw new Error('primarySignal is required')

  const indexKey = `${entityId}:${entityType}`
  if (entityCaseIndex.has(indexKey)) {
    const existingCase = cases.get(entityCaseIndex.get(indexKey))
    if (existingCase && existingCase.status === 'open') {
      return { caseId: existingCase.id, existing: true }
    }
  }

  const signalResult    = evaluateSignal(primarySignal, entityId, entityType, {
    scan_count: 3, deviation_pct: 50, sigma_deviation: 4,
    distance_m: 300, referral_count: 10, payout_count: 6, anomaly_approval_pct: 85,
  })
  const riskScore       = Math.min(100, signalResult.score_contribution)
  const caseId          = crypto.randomUUID()
  const now             = new Date().toISOString()

  const record = {
    id:             caseId,
    entityId,
    entityType,
    riskScore,
    primarySignal,
    status:         'open',
    assignedTo:     null,
    amountAtRiskAud: null,
    openedAt:       now,
    resolvedAt:     null,
    createdAt:      now,
    updatedAt:      now,
  }

  cases.set(caseId, record)
  entityCaseIndex.set(indexKey, caseId)

  if (entityType === 'user') {
    _setActiveFraudCase(entityId, true)
  }

  await audit(AUDIT_ACTIONS.FRAUD_CASE_OPENED, {
    actor:      actor ?? 'system',
    entityId:   caseId,
    entityType: 'fraud_case',
    after:      { entityId, entityType, primarySignal, riskScore },
  })

  bus.publish('fraud.case.opened', { caseId, entityId, entityType, primarySignal, riskScore })

  return { caseId, riskScore, status: 'open', autoHeld: riskScore >= RISK_LEVEL_THRESHOLDS.medium }
}

export async function recordSignal(entityId, entityType, signalType, evidence, { actor } = {}) {
  if (!SIGNAL_WEIGHTS[signalType]) throw new Error(`Unknown signal type: ${signalType}`)

  const result   = evaluateSignal(signalType, entityId, entityType, evidence)
  const signalId = crypto.randomUUID()

  const record = {
    id:         signalId,
    entityId,
    entityType,
    signalType,
    severity:   result.severity,
    ruleId:     result.rule_id,
    evidence,
    triggered:  result.triggered,
    createdAt:  new Date().toISOString(),
  }
  signals.set(signalId, record)

  await audit(AUDIT_ACTIONS.FRAUD_SIGNAL, {
    actor:      actor ?? 'system',
    entityId,
    entityType,
    after:      { signalType, triggered: result.triggered, severity: result.severity, rule_id: result.rule_id },
  })

  if (result.triggered) {
    bus.publish('fraud.signal.raised', { signalId, entityId, entityType, signalType, severity: result.severity })
  }

  return { signalId, ...result }
}

export async function takeAction(caseId, action, reason, { actor, context } = {}) {
  if (!can(context?.role, 'write:fraud.case')) throw new RbacError(`Role '${context?.role}' lacks permission 'write:fraud.case'`, 'write:fraud.case')

  const validActions = ['hold_payout', 'manual_review', 'reject', 'suspend']
  if (!validActions.includes(action)) throw new Error(`Invalid action '${action}'. Must be one of: ${validActions.join(', ')}`)

  if (action === 'suspend' && !can(context?.role, 'suspend:entity')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'suspend:entity'`, 'suspend:entity')
  }

  const fraudCase = cases.get(caseId)
  if (!fraudCase) throw new Error(`Fraud case not found: ${caseId}`)
  if (fraudCase.status === 'resolved') throw new Error(`Cannot take action on a resolved fraud case`)

  const actionId = crypto.randomUUID()
  const now      = new Date().toISOString()

  const actionRecord = {
    id:        actionId,
    caseId,
    action,
    actor,
    reason,
    createdAt: now,
  }
  actions.set(actionId, actionRecord)

  if (action === 'suspend') {
    fraudCase.status    = 'suspended'
    fraudCase.updatedAt = now

    if (fraudCase.entityType === 'user') {
      _setActiveFraudCase(fraudCase.entityId, true)
    }

    bus.publish('fraud.entity.suspended', { entityId: fraudCase.entityId, entityType: fraudCase.entityType, caseId, actor })
  }

  await audit(AUDIT_ACTIONS.FRAUD_ACTION_TAKEN, {
    actor,
    entityId:   caseId,
    entityType: 'fraud_case',
    after:      { action, reason, caseStatus: fraudCase.status },
    meta:       { context },
  })

  return { actionId, caseId, action, status: fraudCase.status }
}

export async function resolveCase(caseId, resolution, { actor, context } = {}) {
  if (!can(context?.role, 'write:fraud.case')) throw new RbacError(`Role '${context?.role}' lacks permission 'write:fraud.case'`, 'write:fraud.case')
  if (!resolution) throw new Error('resolution is required')

  const fraudCase = cases.get(caseId)
  if (!fraudCase) throw new Error(`Fraud case not found: ${caseId}`)
  if (fraudCase.status === 'resolved') throw new Error(`Case ${caseId} is already resolved`)

  const before = { status: fraudCase.status }
  const now    = new Date().toISOString()

  fraudCase.status     = 'resolved'
  fraudCase.resolvedAt = now
  fraudCase.updatedAt  = now

  if (fraudCase.entityType === 'user') {
    _setActiveFraudCase(fraudCase.entityId, false)
  }

  entityCaseIndex.delete(`${fraudCase.entityId}:${fraudCase.entityType}`)

  await audit(AUDIT_ACTIONS.FRAUD_CASE_OPENED, {
    actor,
    entityId:   caseId,
    entityType: 'fraud_case',
    before,
    after:      { status: 'resolved', resolvedAt: now, resolution },
    meta:       { resolution },
  })

  bus.publish('fraud.case.resolved', { caseId, entityId: fraudCase.entityId, entityType: fraudCase.entityType, resolution, actor })

  return { caseId, status: 'resolved', resolvedAt: now }
}

export function getCase(caseId) {
  return cases.get(caseId) ?? null
}

export function getActiveCaseForEntity(entityId, entityType) {
  const key = `${entityId}:${entityType}`
  const caseId = entityCaseIndex.get(key)
  return caseId ? cases.get(caseId) ?? null : null
}

export function getRiskLevel(score) {
  if (score >= RISK_LEVEL_THRESHOLDS.high)   return 'high'
  if (score >= RISK_LEVEL_THRESHOLDS.medium) return 'medium'
  if (score >= RISK_LEVEL_THRESHOLDS.low)    return 'low'
  return 'minimal'
}
