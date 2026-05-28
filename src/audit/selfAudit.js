import { SCHEMA, IMMUTABLE_TABLES, SOFT_DELETE_TABLES, AUDIT_ALL_TABLES } from '../schema/schema.js'
import { PERMISSIONS, ROLES, can, rolesFor } from '../lib/rbac.js'
import { VALID_EVENTS } from '../lib/eventBus.js'
import { auditLog, AUDIT_ACTIONS } from '../lib/audit.js'
import { JOB_TYPES } from '../lib/queue.js'
import { FRAUD_CASES, RISK_ENTITIES, PAYOUT_HOLDS, RISK_RULES } from '../data/fraudRisk.js'
import { MERCHANTS, LISTINGS } from '../data/marketplace.js'

export const CHECK_CATEGORIES = ['schema', 'rbac', 'data', 'events', 'integrity']

const VALID_SIGNALS = new Set([
  'duplicate_scan', 'fake_deposit', 'abnormal_weight', 'gps_mismatch',
  'referral_abuse', 'payout_abuse', 'suspicious_operator',
])

// ─── Schema Checks ────────────────────────────────────────────────────────────

export function checkSchema001() {
  const missing = IMMUTABLE_TABLES.filter(t => !SCHEMA[t])
  return {
    id: 'SCHEMA_001',
    name: 'Immutable table write protection',
    category: 'schema',
    status: missing.length === 0 ? 'pass' : 'warn',
    detail: missing.length === 0
      ? `All ${IMMUTABLE_TABLES.length} immutable tables are registered in SCHEMA.`
      : `Missing from SCHEMA: ${missing.join(', ')}`,
    count: missing.length || undefined,
  }
}

export function checkSchema002() {
  const missing = SOFT_DELETE_TABLES.filter(t => {
    const table = SCHEMA[t]
    return !table || !table.fields?.deleted_at
  })
  return {
    id: 'SCHEMA_002',
    name: 'Soft-delete coverage',
    category: 'schema',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail: missing.length === 0
      ? `All ${SOFT_DELETE_TABLES.length} soft-delete tables have a deleted_at field.`
      : `Missing deleted_at field: ${missing.join(', ')}`,
    count: missing.length || undefined,
  }
}

export function checkSchema003() {
  const broken = AUDIT_ALL_TABLES.filter(t => {
    const f = SCHEMA[t]?.fields
    return !f || !f.created_at || !f.updated_at
  })
  return {
    id: 'SCHEMA_003',
    name: 'Audit coverage (created_at / updated_at)',
    category: 'schema',
    status: broken.length === 0 ? 'pass' : 'warn',
    detail: broken.length === 0
      ? `All ${AUDIT_ALL_TABLES.length} audit_all tables have created_at and updated_at fields.`
      : `Missing timestamp fields: ${broken.join(', ')}`,
    count: broken.length || undefined,
  }
}

export function checkSchema004() {
  const broken = []
  for (const [tableName, table] of Object.entries(SCHEMA)) {
    const fks = (table.constraints ?? []).filter(c => c.type === 'foreign_key')
    for (const fk of fks) {
      const refTable = fk.to?.split('.')[0]
      if (refTable && !SCHEMA[refTable]) {
        broken.push(`${tableName}.${fk.from} → ${fk.to}`)
      }
    }
  }
  return {
    id: 'SCHEMA_004',
    name: 'Foreign key integrity',
    category: 'schema',
    status: broken.length === 0 ? 'pass' : 'fail',
    detail: broken.length === 0
      ? 'All foreign key constraints reference valid tables.'
      : `Broken references: ${broken.join('; ')}`,
    count: broken.length || undefined,
  }
}

// ─── RBAC Checks ──────────────────────────────────────────────────────────────

export function checkRbac001() {
  const uncovered = Object.values(ROLES).filter(role => {
    return Object.values(PERMISSIONS).every(roles => !roles.includes(role))
  })
  return {
    id: 'RBAC_001',
    name: 'Permission coverage — all roles have at least one permission',
    category: 'rbac',
    status: uncovered.length === 0 ? 'pass' : 'warn',
    detail: uncovered.length === 0
      ? `All ${Object.keys(ROLES).length} roles have at least one permission.`
      : `Roles with zero permissions: ${uncovered.join(', ')}`,
    count: uncovered.length || undefined,
  }
}

export function checkRbac002() {
  const orphaned = Object.keys(PERMISSIONS).filter(perm => rolesFor(perm).length === 0)
  return {
    id: 'RBAC_002',
    name: 'No permission without role',
    category: 'rbac',
    status: orphaned.length === 0 ? 'pass' : 'warn',
    detail: orphaned.length === 0
      ? 'Every permission entry has at least one role assigned.'
      : `Permissions with no roles: ${orphaned.join(', ')}`,
    count: orphaned.length || undefined,
  }
}

export function checkRbac003() {
  const missing = Object.keys(PERMISSIONS).filter(perm => !can(ROLES.super_admin, perm))
  return {
    id: 'RBAC_003',
    name: 'Super admin has all permissions',
    category: 'rbac',
    status: missing.length === 0 ? 'pass' : 'fail',
    detail: missing.length === 0
      ? `super_admin passes all ${Object.keys(PERMISSIONS).length} permission checks.`
      : `super_admin is missing: ${missing.join(', ')}`,
    count: missing.length || undefined,
  }
}

export function checkRbac004() {
  const violations = []
  if (can(ROLES.consumer, 'run:self_audit'))  violations.push('consumer can run:self_audit')
  if (can(ROLES.consumer, 'write:pricing'))   violations.push('consumer can write:pricing')
  if (can(ROLES.merchant, 'suspend:entity'))  violations.push('merchant can suspend:entity')
  return {
    id: 'RBAC_004',
    name: 'Consumer/merchant cannot access admin-only resources',
    category: 'rbac',
    status: violations.length === 0 ? 'pass' : 'fail',
    detail: violations.length === 0
      ? 'Consumer and merchant roles correctly denied admin-only permissions.'
      : `Unexpected access granted: ${violations.join('; ')}`,
    count: violations.length || undefined,
  }
}

// ─── Data Checks ──────────────────────────────────────────────────────────────

export function checkData001() {
  const merchantIds = new Set(MERCHANTS.map(m => m.id))
  const orphaned = LISTINGS.filter(l => !merchantIds.has(l.merchant_id))
  const autoFixed = false
  return {
    id: 'DATA_001',
    name: 'Merchant-listing consistency',
    category: 'data',
    status: orphaned.length === 0 ? 'pass' : 'fail',
    detail: orphaned.length === 0
      ? `All ${LISTINGS.length} listings reference a valid merchant.`
      : `${orphaned.length} orphaned listing(s) found (IDs: ${orphaned.map(l => l.id).join(', ')}). Auto-fix would set merchant_id = null and flag for admin review.`,
    autoFixed,
    count: orphaned.length || undefined,
  }
}

export function checkData002() {
  const entityIds = new Set(RISK_ENTITIES.map(e => e.id))
  const broken = FRAUD_CASES.filter(c => !entityIds.has(c.entity_id))
  return {
    id: 'DATA_002',
    name: 'Fraud case entity references',
    category: 'data',
    status: broken.length === 0 ? 'pass' : 'warn',
    detail: broken.length === 0
      ? `All ${FRAUD_CASES.length} fraud cases reference a valid RISK_ENTITY.`
      : `${broken.length} fraud case(s) with missing entity reference: ${broken.map(c => c.id).join(', ')}`,
    count: broken.length || undefined,
  }
}

export function checkData003() {
  const caseIds = new Set(FRAUD_CASES.map(c => c.id))
  const broken = PAYOUT_HOLDS.filter(h => !caseIds.has(h.case_id))
  return {
    id: 'DATA_003',
    name: 'Payout holds reference valid cases',
    category: 'data',
    status: broken.length === 0 ? 'pass' : 'warn',
    detail: broken.length === 0
      ? `All ${PAYOUT_HOLDS.length} payout holds reference a valid fraud case.`
      : `${broken.length} hold(s) with invalid case_id: ${broken.map(h => h.id).join(', ')}`,
    count: broken.length || undefined,
  }
}

export function checkData004() {
  const invalid = RISK_RULES.filter(r => !VALID_SIGNALS.has(r.signal))
  return {
    id: 'DATA_004',
    name: 'Risk rule signal coverage',
    category: 'data',
    status: invalid.length === 0 ? 'pass' : 'fail',
    detail: invalid.length === 0
      ? `All ${RISK_RULES.length} risk rules use recognised signal keys.`
      : `Unknown signal(s) in rules: ${invalid.map(r => `${r.id}:${r.signal}`).join(', ')}`,
    count: invalid.length || undefined,
  }
}

export function checkData005() {
  const seen = new Map()
  const dupes = []
  for (const m of MERCHANTS) {
    const key = m.name.toLowerCase()
    if (seen.has(key)) dupes.push(m.name)
    else seen.set(key, m.id)
  }
  return {
    id: 'DATA_005',
    name: 'Duplicate detection — merchants',
    category: 'data',
    status: dupes.length === 0 ? 'pass' : 'warn',
    detail: dupes.length === 0
      ? `No duplicate merchant names found across ${MERCHANTS.length} merchants.`
      : `Duplicate merchant names (case-insensitive): ${dupes.join(', ')}`,
    count: dupes.length || undefined,
  }
}

export function checkData006() {
  const dupeCount = { total: 0, pairs: [] }
  const byMerchant = new Map()
  for (const l of LISTINGS) {
    if (!byMerchant.has(l.merchant_id)) byMerchant.set(l.merchant_id, new Map())
    const nameMap = byMerchant.get(l.merchant_id)
    const key = l.name.toLowerCase()
    if (nameMap.has(key)) {
      dupeCount.total++
      dupeCount.pairs.push(`${l.merchant_id}:"${l.name}"`)
    } else {
      nameMap.set(key, l.id)
    }
  }
  return {
    id: 'DATA_006',
    name: 'Duplicate detection — listings per merchant',
    category: 'data',
    status: dupeCount.total === 0 ? 'pass' : 'warn',
    detail: dupeCount.total === 0
      ? `No duplicate listing names found within any merchant's catalogue.`
      : `${dupeCount.total} duplicate listing name(s): ${dupeCount.pairs.join('; ')}`,
    count: dupeCount.total || undefined,
  }
}

// ─── Event Checks ─────────────────────────────────────────────────────────────

export function checkEvents001() {
  const allEvents = [...VALID_EVENTS]
  const unmatched = []
  for (const [key, jobType] of Object.entries(JOB_TYPES)) {
    const prefix = jobType.split('.')[0]
    const hasMatch = allEvents.some(e => e.startsWith(prefix))
    if (!hasMatch) unmatched.push(`${key} (${jobType})`)
  }
  return {
    id: 'EVENTS_001',
    name: 'All job types have event counterparts',
    category: 'events',
    status: unmatched.length === 0 ? 'pass' : 'warn',
    detail: unmatched.length === 0
      ? `All ${Object.keys(JOB_TYPES).length} job types have at least one matching event prefix in VALID_EVENTS.`
      : `No event prefix match found for: ${unmatched.join(', ')}`,
    count: unmatched.length || undefined,
  }
}

// ─── Integrity Checks ─────────────────────────────────────────────────────────

export function checkIntegrity001() {
  const individualSum = PAYOUT_HOLDS.reduce((acc, h) => acc + (h.amount_aud ?? 0), 0)
  const reported = 9_510
  const discrepancy = Math.abs(individualSum - reported)
  const match = discrepancy < 0.01
  return {
    id: 'INTEGRITY_001',
    name: 'Ledger balance simulation — payout holds',
    category: 'integrity',
    status: match ? 'pass' : 'fail',
    detail: match
      ? `Payout hold totals consistent: $${individualSum.toLocaleString()} AUD across ${PAYOUT_HOLDS.length} holds.`
      : `Discrepancy detected: individual sum $${individualSum.toLocaleString()} AUD vs reported $${reported.toLocaleString()} AUD (Δ $${discrepancy.toFixed(2)}).`,
  }
}

export function checkIntegrity002() {
  const violations = []
  for (const entity of RISK_ENTITIES) {
    if (entity.risk_score < 0 || entity.risk_score > 100) {
      violations.push(`${entity.id} risk_score=${entity.risk_score}`)
    }
    if (entity.signals) {
      for (const [signal, score] of Object.entries(entity.signals)) {
        if (score < 0 || score > 100) {
          violations.push(`${entity.id} signal.${signal}=${score}`)
        }
      }
    }
  }
  return {
    id: 'INTEGRITY_002',
    name: 'Risk score bounds (0–100)',
    category: 'integrity',
    status: violations.length === 0 ? 'pass' : 'fail',
    detail: violations.length === 0
      ? `All ${RISK_ENTITIES.length} entity risk scores and signal scores are within 0–100.`
      : `Out-of-bounds values: ${violations.join('; ')}`,
    count: violations.length || undefined,
  }
}

export function checkIntegrity003() {
  const caseEntityIds = new Set(FRAUD_CASES.map(c => c.entity_id))
  const violations = RISK_ENTITIES.filter(e => {
    return e.status === 'suspended' && e.active_cases === 0 && !caseEntityIds.has(e.id)
  })
  return {
    id: 'INTEGRITY_003',
    name: 'Active cases vs entity status',
    category: 'integrity',
    status: violations.length === 0 ? 'pass' : 'warn',
    detail: violations.length === 0
      ? 'All suspended entities have active cases or an associated fraud case record.'
      : `Suspended entities with no case evidence: ${violations.map(e => e.id).join(', ')}`,
    count: violations.length || undefined,
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runSelfAudit({ actor = 'system' } = {}) {
  const startTs = Date.now()

  const checks = await Promise.all([
    checkSchema001(),
    checkSchema002(),
    checkSchema003(),
    checkSchema004(),
    checkRbac001(),
    checkRbac002(),
    checkRbac003(),
    checkRbac004(),
    checkData001(),
    checkData002(),
    checkData003(),
    checkData004(),
    checkData005(),
    checkData006(),
    checkEvents001(),
    checkIntegrity001(),
    checkIntegrity002(),
    checkIntegrity003(),
  ])

  const duration_ms = Date.now() - startTs

  const summary = {
    total:      checks.length,
    passed:     checks.filter(c => c.status === 'pass').length,
    warned:     checks.filter(c => c.status === 'warn').length,
    failed:     checks.filter(c => c.status === 'fail').length,
    auto_fixed: checks.filter(c => c.autoFixed).length,
  }

  await auditLog.append({
    action:     AUDIT_ACTIONS.SELF_AUDIT_RUN,
    actor,
    entityType: 'platform',
    meta:       { summary, duration_ms },
  })

  return { summary, checks, duration_ms, ran_at: new Date().toISOString(), actor }
}
