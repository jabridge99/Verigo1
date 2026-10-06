// Typed monitoring-rules client — twentieth pilot for the shared
// lib/api/client.ts pattern. Covers app/monitoring-rules/page.tsx's
// 5 /api/v1/monitoring/rules* call sites: list, create, update,
// status toggle, delete. Genuinely distinct from the Rule Builder
// (app/rule-builder/page.tsx, /api/v1/rule-builder/*) despite the
// similar naming — this is the no-code transaction-monitoring engine
// (app/api/routes/monitoring.py), not the automation-rule engine.
//
// Types mirror app/schemas/monitoring.py's MonitoringRuleOut/
// MonitoringRuleListOut/MonitoringRuleCreate/MonitoringRuleUpdate and
// RuleConditionGroupOut/RuleConditionOut.

import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client'

export type RuleStatus = 'active' | 'inactive' | 'testing' | 'archived'

export interface Condition {
  id?: string
  condition_order: number
  field_path: string
  operator: string
  value?: unknown
  value_label?: string | null
}

export interface ConditionGroup {
  id?: string
  group_order: number
  description?: string | null
  conditions: Condition[]
}

/** Full rule detail — GET /rules/{id}, and the response of create/update/status endpoints. */
export interface Rule {
  id: string
  org_id: string
  name: string
  description?: string | null
  rule_ref?: string | null
  category: string
  alert_type: string
  status: RuleStatus
  is_system_rule: boolean
  alert_severity: string
  alert_score: number
  alert_title_template?: string | null
  lookback_days?: number | null
  lookback_count?: number | null
  tags: string[]
  applicable_customer_types: string[]
  applicable_payment_methods: string[]
  total_alerts_generated: number
  false_positive_rate?: number | null
  last_triggered_at?: string | null
  created_at: string
  condition_groups: ConditionGroup[]
}

/** Slimmer row shape returned by GET /rules — deliberately missing several
 * fields (alert_score, lookback_*, condition_groups, ...) that Rule has. */
export interface RuleListItem {
  id: string
  name: string
  rule_ref?: string | null
  category: string
  status: RuleStatus
  alert_severity: string
  is_system_rule: boolean
  total_alerts_generated: number
  false_positive_rate?: number | null
  last_triggered_at?: string | null
}

export interface ConditionInput {
  condition_order: number
  field_path: string
  operator: string
  value?: unknown
  value_label?: string | null
}

export interface ConditionGroupInput {
  group_order: number
  description?: string | null
  conditions: ConditionInput[]
}

export interface RuleCreateInput {
  name: string
  description?: string
  rule_ref?: string
  category: string
  alert_type?: string
  alert_severity?: string
  alert_score?: number
  alert_title_template?: string
  lookback_days?: number
  lookback_count?: number
  tags?: string[]
  applicable_customer_types?: string[]
  applicable_payment_methods?: string[]
  condition_groups: ConditionGroupInput[]
}

export interface RuleUpdateInput {
  name?: string
  description?: string
  status?: RuleStatus
  alert_severity?: string
  alert_score?: number
  alert_title_template?: string
  lookback_days?: number
  lookback_count?: number
  tags?: string[]
  applicable_customer_types?: string[]
  applicable_payment_methods?: string[]
}

export interface ListRulesFilters {
  category?: string
  rule_status?: string
}

/** GET /monitoring/rules */
export function listMonitoringRules(filters: ListRulesFilters = {}): Promise<RuleListItem[]> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.rule_status) params.set('rule_status', filters.rule_status)
  const qs = params.toString()
  return apiGet(`/api/v1/monitoring/rules${qs ? `?${qs}` : ''}`)
}

/** GET /monitoring/rules/{id} */
export function getMonitoringRule(ruleId: string): Promise<Rule> {
  return apiGet(`/api/v1/monitoring/rules/${ruleId}`)
}

/** POST /monitoring/rules */
export function createMonitoringRule(payload: RuleCreateInput): Promise<Rule> {
  return apiPost('/api/v1/monitoring/rules', payload)
}

/** PUT /monitoring/rules/{id} */
export function updateMonitoringRule(ruleId: string, payload: RuleUpdateInput): Promise<Rule> {
  return apiPut(`/api/v1/monitoring/rules/${ruleId}`, payload)
}

/** PATCH /monitoring/rules/{id}/status?new_status=... */
export function setMonitoringRuleStatus(ruleId: string, newStatus: RuleStatus): Promise<Rule> {
  return apiPatch(`/api/v1/monitoring/rules/${ruleId}/status?new_status=${newStatus}`)
}

/** DELETE /monitoring/rules/{id} */
export function deleteMonitoringRule(ruleId: string): Promise<void> {
  return apiDelete(`/api/v1/monitoring/rules/${ruleId}`)
}
