import { bus } from '../lib/eventBus.js'
import { can, RbacError } from '../lib/rbac.js'
import { audit, AUDIT_ACTIONS } from '../lib/audit.js'

export const COMMODITY_PRICES = {
  copper:    14.80,
  aluminium:  4.20,
  steel:      1.85,
  pcb:       22.40,
  battery:    3.10,
}

export const LOGISTICS_COST_PER_KG  = 0.15
export const PROCESSING_COST_PER_KG = 0.08
export const DEFAULT_MARGIN         = 0.25

const PTS_PER_AUD = 20   // 1 AUD = 20 points (inverse of PTS_TO_AUD = 0.05)

// Active overrides: commodity → { value, reason, actor, appliedAt, expiresAt }
const activeOverrides = new Map()
const overrideHistory = []
let   pricingFrozen   = false
let   frozenAt        = null
let   frozenBy        = null
let   frozenReason    = null
let   modelSequence   = 0

function currentBasePrice(commodity) {
  if (!COMMODITY_PRICES[commodity]) throw new Error(`Unknown commodity: ${commodity}`)
  const override = activeOverrides.get(commodity)
  if (override) {
    if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
      activeOverrides.delete(commodity)
    } else {
      return override.value
    }
  }
  return COMMODITY_PRICES[commodity]
}

function computeOffer(itemType, weight_kg, { margin = DEFAULT_MARGIN } = {}) {
  if (!COMMODITY_PRICES[itemType]) throw new Error(`Unknown item type: ${itemType}`)
  if (typeof weight_kg !== 'number' || weight_kg <= 0) throw new Error('weight_kg must be a positive number')

  const basePrice     = currentBasePrice(itemType)
  const grossRecovery = basePrice * weight_kg
  const logistics     = LOGISTICS_COST_PER_KG * weight_kg
  const processing    = PROCESSING_COST_PER_KG * weight_kg
  const netRecovery   = grossRecovery - logistics - processing
  const audValue      = Math.max(0, netRecovery * (1 - margin))
  const points        = Math.round(audValue * PTS_PER_AUD)

  return { audValue: parseFloat(audValue.toFixed(4)), points, grossRecovery, netRecovery, logistics, processing, margin }
}

export function getOffer(itemType, weight_kg, { mode = 'production' } = {}) {
  if (pricingFrozen) {
    throw new Error(`Pricing is currently frozen (since ${frozenAt}) — reason: ${frozenReason}`)
  }

  if (!['production', 'shadow'].includes(mode)) throw new Error(`Invalid mode '${mode}'. Use 'production' or 'shadow'`)

  const margin   = mode === 'shadow' ? DEFAULT_MARGIN * 0.9 : DEFAULT_MARGIN
  const computed = computeOffer(itemType, weight_kg, { margin })
  const modelId  = `MODEL_${itemType.toUpperCase()}_${++modelSequence}`

  const result = {
    points:      computed.points,
    aud_value:   computed.audValue,
    mode,
    model_id:    modelId,
    computed_at: new Date().toISOString(),
  }

  if (mode === 'shadow') {
    return { ...result, _shadow: true, _internal: true }
  }

  return result
}

export async function applyOverride(commodity, value, reason, { actor, context } = {}) {
  if (!can(context?.role, 'write:pricing.override')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'write:pricing.override'`, 'write:pricing.override')
  }
  if (!COMMODITY_PRICES[commodity]) throw new Error(`Unknown commodity: ${commodity}`)
  if (typeof value !== 'number' || value <= 0) throw new Error('value must be a positive number')
  if (!reason) throw new Error('reason is required')

  const previousValue = currentBasePrice(commodity)
  const now           = new Date().toISOString()
  const expiresAt     = context?.expiresAt ?? null

  const override = { value, reason, actor, appliedAt: now, expiresAt }
  activeOverrides.set(commodity, override)

  const historyEntry = {
    id:            crypto.randomUUID(),
    commodity,
    overrideValue: value,
    previousValue,
    reason,
    actor,
    approvedBy:    context?.approvedBy ?? null,
    approvedAt:    context?.approvedBy ? now : null,
    expiresAt,
    createdAt:     now,
  }
  overrideHistory.push(historyEntry)

  await audit(AUDIT_ACTIONS.PRICE_OVERRIDE, {
    actor,
    entityId:   commodity,
    entityType: 'commodity',
    before:     { value: previousValue },
    after:      { value, reason, expiresAt },
    meta:       { context },
  })

  bus.publish('pricing.updated',           { commodity, previousValue, newValue: value, actor })
  bus.publish('pricing.override.applied',  { commodity, previousValue, newValue: value, reason, actor, expiresAt })

  return { commodity, previousValue, newValue: value, appliedAt: now, expiresAt }
}

export async function freezePricing(reason, { actor, context } = {}) {
  if (!can(context?.role, 'write:pricing')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'write:pricing'`, 'write:pricing')
  }
  if (!reason) throw new Error('reason is required to freeze pricing')

  pricingFrozen = true
  frozenAt      = new Date().toISOString()
  frozenBy      = actor
  frozenReason  = reason

  await audit(AUDIT_ACTIONS.PRICE_FREEZE, {
    actor,
    entityId:   'pricing',
    entityType: 'system',
    after:      { frozen: true, reason, frozenAt },
    meta:       { context },
  })

  bus.publish('pricing.updated', { event: 'pricing.frozen', reason, actor, frozenAt })

  return { frozen: true, frozenAt, frozenBy, reason }
}

export async function unfreezePricing({ actor, context } = {}) {
  if (!can(context?.role, 'write:pricing')) {
    throw new RbacError(`Role '${context?.role}' lacks permission 'write:pricing'`, 'write:pricing')
  }
  if (!pricingFrozen) throw new Error('Pricing is not currently frozen')

  const wasAt  = frozenAt
  pricingFrozen = false
  frozenAt      = null
  frozenBy      = null
  frozenReason  = null

  await audit(AUDIT_ACTIONS.PRICE_FREEZE, {
    actor,
    entityId:   'pricing',
    entityType: 'system',
    before:     { frozen: true },
    after:      { frozen: false, unfrozenAt: new Date().toISOString() },
    meta:       { context },
  })

  bus.publish('pricing.updated', { event: 'pricing.unfrozen', actor, previouslyFrozenAt: wasAt })

  return { frozen: false }
}

export function compareShadowVsProduction(itemType, weight_kg) {
  const production = computeOffer(itemType, weight_kg, { margin: DEFAULT_MARGIN })
  const shadow     = computeOffer(itemType, weight_kg, { margin: DEFAULT_MARGIN * 0.9 })

  const deltaAud     = parseFloat((shadow.audValue - production.audValue).toFixed(4))
  const deltaPct     = production.audValue > 0
    ? parseFloat(((deltaAud / production.audValue) * 100).toFixed(2))
    : 0

  const betterForConsumer = shadow.audValue > production.audValue
  const betterForOperator = production.audValue > shadow.audValue
  const betterMargin      = shadow.margin < production.margin

  bus.publish('pricing.shadow.diverged', {
    itemType, weight_kg, deltaAud, deltaPct,
    shadowAud: shadow.audValue, productionAud: production.audValue,
  })

  return {
    production: {
      aud_value: production.audValue,
      points:    production.points,
      margin:    production.margin,
    },
    shadow: {
      aud_value: shadow.audValue,
      points:    shadow.points,
      margin:    shadow.margin,
    },
    delta: {
      aud:     deltaAud,
      pct:     deltaPct,
    },
    analysis: {
      betterForConsumer,
      betterForOperator,
      betterMargin,
    },
    _internal:     true,
    computed_at:   new Date().toISOString(),
  }
}

export function getPricingState() {
  return {
    frozen:          pricingFrozen,
    frozenAt,
    frozenBy,
    frozenReason,
    activeOverrides: Object.fromEntries(activeOverrides),
    basePrice:       { ...COMMODITY_PRICES },
  }
}

export function getOverrideHistory() {
  return [...overrideHistory]
}
