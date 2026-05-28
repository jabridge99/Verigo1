// Role-Based Access Control — single source of truth for all permissions

export const ROLES = {
  // Platform
  super_admin:          'super_admin',
  platform_admin:       'platform_admin',
  // Finance
  treasurer:            'treasurer',
  payout_approver:      'payout_approver',
  // Pricing
  pricing_manager:      'pricing_manager',
  pricing_analyst:      'pricing_analyst',
  // Risk
  risk_analyst:         'risk_analyst',
  compliance:           'compliance',
  // Operations
  ops_manager:          'ops_manager',
  operator:             'operator',
  logistics_contractor: 'logistics_contractor',
  // Merchants / Consumers
  merchant:             'merchant',
  consumer:             'consumer',
  // Audit
  audit_viewer:         'audit_viewer',
}

// Permission → action:resource notation
export const PERMISSIONS = {
  // Audit
  'read:audit':               [ROLES.super_admin, ROLES.platform_admin, ROLES.compliance, ROLES.audit_viewer, ROLES.risk_analyst],
  'export:audit':             [ROLES.super_admin, ROLES.compliance],
  // Pricing
  'read:pricing':             [ROLES.super_admin, ROLES.platform_admin, ROLES.pricing_manager, ROLES.pricing_analyst, ROLES.ops_manager],
  'write:pricing':            [ROLES.super_admin, ROLES.pricing_manager],
  'write:pricing.override':   [ROLES.super_admin, ROLES.pricing_manager],
  'read:shadow_lab':          [ROLES.super_admin, ROLES.platform_admin, ROLES.pricing_manager, ROLES.pricing_analyst],
  'write:shadow_lab':         [ROLES.super_admin, ROLES.pricing_manager],
  // Payout
  'read:payout':              [ROLES.super_admin, ROLES.platform_admin, ROLES.treasurer, ROLES.payout_approver],
  'approve:payout':           [ROLES.super_admin, ROLES.payout_approver],
  'hold:payout':              [ROLES.super_admin, ROLES.payout_approver, ROLES.risk_analyst],
  'release:payout':           [ROLES.super_admin, ROLES.treasurer],
  // Fraud
  'read:fraud':               [ROLES.super_admin, ROLES.platform_admin, ROLES.risk_analyst, ROLES.compliance],
  'write:fraud.case':         [ROLES.super_admin, ROLES.risk_analyst, ROLES.compliance],
  'suspend:entity':           [ROLES.super_admin, ROLES.risk_analyst],
  // Settlement
  'read:settlement':          [ROLES.super_admin, ROLES.platform_admin, ROLES.treasurer, ROLES.ops_manager],
  'write:settlement':         [ROLES.super_admin, ROLES.treasurer],
  'approve:settlement':       [ROLES.super_admin, ROLES.treasurer],
  // Operations
  'read:operations':          [ROLES.super_admin, ROLES.platform_admin, ROLES.ops_manager, ROLES.operator],
  'write:station':            [ROLES.super_admin, ROLES.ops_manager],
  'approve:deposit':          [ROLES.operator, ROLES.ops_manager, ROLES.super_admin],
  // KYC
  'read:kyc':                 [ROLES.super_admin, ROLES.platform_admin, ROLES.compliance],
  'write:kyc':                [ROLES.super_admin, ROLES.compliance],
  // Marketplace
  'read:marketplace':         [ROLES.super_admin, ROLES.platform_admin, ROLES.merchant, ROLES.consumer],
  'write:marketplace.listing':[ROLES.super_admin, ROLES.merchant],
  'approve:merchant':         [ROLES.super_admin, ROLES.platform_admin],
  // Webhooks
  'manage:webhooks':          [ROLES.super_admin, ROLES.platform_admin],
  // API tokens
  'manage:api_tokens':        [ROLES.super_admin, ROLES.platform_admin],
  // Engineering
  'read:engineering':         [ROLES.super_admin, ROLES.platform_admin],
  'run:self_audit':           [ROLES.super_admin],
}

export function can(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false
}

export function canAll(role, permissions) {
  return permissions.every(p => can(role, p))
}

export function canAny(role, permissions) {
  return permissions.some(p => can(role, p))
}

export function permissionsFor(role) {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm)
}

export function rolesFor(permission) {
  return PERMISSIONS[permission] ?? []
}

// Decorator-style guard for service functions
export function requirePermission(permission, fn) {
  return function (context, ...args) {
    if (!context?.role) throw new RbacError('No role in context', permission)
    if (!can(context.role, permission)) {
      throw new RbacError(`Role '${context.role}' lacks permission '${permission}'`, permission)
    }
    return fn(context, ...args)
  }
}

export class RbacError extends Error {
  constructor(message, permission) {
    super(message)
    this.name = 'RbacError'
    this.permission = permission
    this.status = 403
  }
}
