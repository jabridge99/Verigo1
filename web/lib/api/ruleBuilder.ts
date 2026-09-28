// Typed rule-builder-resource client — nineteenth pilot for the
// shared lib/api/client.ts pattern. Covers app/rule-builder/page.tsx's
// all 8 /api/v1/rule-builder/rules* call sites: list, reference,
// create, update, delete, test (dry-run), executions, and version
// history. The same backend route file also has a `/decision-support`
// sub-resource — a separate frontend page's (app/decision-support/page.tsx)
// concern, not called here, left for its own pilot.
//
// Types mirror app/api/routes/rule_builder.py's _rule_dict() and the
// literal return shapes of rule_builder_reference()/test_rule()/
// rule_executions()/rule_versions(), and app/schemas/automation_rule.py's
// RuleCreate/RuleUpdate/ConditionGroupSchema/ActionSchema — scoped to
// the fields the page's own pre-existing local types already declared.

import { apiGet, apiPost, apiPatch, apiDelete } from './client'

export type RuleStatus = 'active' | 'inactive' | 'testing' | 'archived'

export interface Condition {
  field: string
  operator: string
  value: unknown
  value_label?: string | null
  negate: boolean
}

export interface ConditionGroup {
  logic: 'AND' | 'OR'
  description?: string | null
  negate: boolean
  conditions: Condition[]
  groups: ConditionGroup[]
}

export interface Action {
  action_type: string
  params: Record<string, unknown>
  delay_minutes: number
  description?: string | null
}

export interface Rule {
  id: string
  rule_ref: string
  name: string
  description?: string | null
  event_type: string
  status: RuleStatus
  is_system: boolean
  priority: number
  condition_groups: ConditionGroup[]
  actions: Action[]
  applicable_industries: string[]
  tags: string[]
  trigger_count: number
  last_triggered_at?: string | null
  last_executed_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at?: string | null
}

export interface Reference {
  event_types: { value: string; label: string }[]
  action_types: { value: string; label: string }[]
  operators: { value: string; label: string }[]
  condition_fields: Record<string, string[]>
  action_params_reference: Record<string, { required?: string[]; optional?: string[]; note?: string }>
  disclaimer: string
}

export interface RuleCreateInput {
  name: string
  description?: string
  event_type: string
  priority: number
  condition_groups: ConditionGroup[]
  actions: Action[]
}

export interface RuleUpdateInput extends Partial<RuleCreateInput> {
  status?: RuleStatus
}

export interface RuleTestResult {
  rule_id: string
  matched: boolean
  matched_group_index: number | null
  would_execute_actions: Action[]
  disclaimer: string
}

export interface RuleExecution {
  id: string
  event_type: string
  entity_type?: string | null
  entity_id?: string | null
  conditions_matched: boolean
  actions_executed: { action_type: string; result?: string }[]
  is_shadow_mode: boolean
  execution_time_ms?: number | null
  error_message?: string | null
  executed_at: string
}

export interface RuleVersion {
  id: string
  version_number: number
  name: string
  status: string
  change_summary?: string | null
  changed_by?: string | null
  created_at: string
}

/** GET /rule-builder/rules */
export function listRules(): Promise<Rule[]> {
  return apiGet('/api/v1/rule-builder/rules')
}

/** GET /rule-builder/rules/reference */
export function getRuleBuilderReference(): Promise<Reference> {
  return apiGet('/api/v1/rule-builder/rules/reference')
}

/** POST /rule-builder/rules */
export function createRule(payload: RuleCreateInput): Promise<Rule> {
  return apiPost('/api/v1/rule-builder/rules', payload)
}

/** PATCH /rule-builder/rules/{id} */
export function updateRule(ruleId: string, payload: RuleUpdateInput): Promise<Rule> {
  return apiPatch(`/api/v1/rule-builder/rules/${ruleId}`, payload)
}

/** DELETE /rule-builder/rules/{id} */
export function deleteRule(ruleId: string): Promise<void> {
  return apiDelete(`/api/v1/rule-builder/rules/${ruleId}`)
}

/** POST /rule-builder/rules/{id}/test */
export function testRule(ruleId: string, context: unknown): Promise<RuleTestResult> {
  return apiPost(`/api/v1/rule-builder/rules/${ruleId}/test`, { context })
}

/** GET /rule-builder/rules/{id}/executions */
export function listRuleExecutions(ruleId: string): Promise<RuleExecution[]> {
  return apiGet(`/api/v1/rule-builder/rules/${ruleId}/executions`)
}

/** GET /rule-builder/rules/{id}/versions */
export function listRuleVersions(ruleId: string): Promise<RuleVersion[]> {
  return apiGet(`/api/v1/rule-builder/rules/${ruleId}/versions`)
}
