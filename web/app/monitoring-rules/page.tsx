"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radar, Plus, RefreshCw, Trash2, X, CheckCircle, AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1/monitoring`;

// ── Types (mirrors app/models/monitoring.py's MonitoringRule) ──────────────
// P25: this is the "no-code" transaction-monitoring rule engine that was
// running correctly with no admin UI -- rules could only be seeded/edited
// directly in the database. This page is that UI, against the existing,
// unchanged backend API (app/api/routes/monitoring.py). AutomationRule /
// Rule Builder (web/app/rule-builder) is a separate, independent engine;
// this page does not touch it.

type RuleStatus = "active" | "inactive" | "testing" | "archived";

const CATEGORIES = [
  "structuring", "smurfing", "rapid_movement", "high_value", "near_threshold",
  "velocity_breach", "frequency_anomaly", "dormant_reactivation", "round_number",
  "sanctions_exposure", "pep_exposure", "adverse_media", "high_risk_country",
  "sanctioned_jurisdiction", "wallet_risk", "crypto_mixer", "darknet_exposure",
  "unusual_behaviour", "profile_deviation", "occupation_mismatch",
  "source_of_funds_concern", "cross_border_risk", "cash_intensive",
  "third_party_risk", "threshold_breach", "custom",
] as const;

const ALERT_TYPES = ["rule_triggered", "behaviour_anomaly", "manual", "system"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES: RuleStatus[] = ["active", "inactive", "testing", "archived"];

const OPERATORS: { value: string; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "ne", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "is_true", label: "is true" },
  { value: "is_false", label: "is false" },
  { value: "is_null", label: "is null" },
  { value: "between", label: "between" },
];

const LIST_VALUE_OPERATORS = new Set(["in", "not_in", "between"]);
const NO_VALUE_OPERATORS = new Set(["is_true", "is_false", "is_null"]);

interface Condition {
  condition_order: number;
  field_path: string;
  operator: string;
  value?: unknown;
  value_label?: string | null;
}

interface ConditionGroup {
  group_order: number;
  description?: string | null;
  conditions: Condition[];
}

interface Rule {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  rule_ref?: string | null;
  category: string;
  alert_type: string;
  status: RuleStatus;
  is_system_rule: boolean;
  alert_severity: string;
  alert_score: number;
  alert_title_template?: string | null;
  lookback_days?: number | null;
  lookback_count?: number | null;
  tags: string[];
  applicable_customer_types: string[];
  applicable_payment_methods: string[];
  total_alerts_generated: number;
  false_positive_rate?: number | null;
  last_triggered_at?: string | null;
  created_at: string;
  condition_groups: ConditionGroup[];
}

const STATUS_COLOR: Record<RuleStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  inactive: "bg-slate-600/20 text-slate-400",
  testing: "bg-amber-500/20 text-amber-300",
  archived: "bg-slate-700/30 text-slate-500",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-slate-600/20 text-slate-400",
  medium: "bg-amber-500/20 text-amber-300",
  high: "bg-orange-500/20 text-orange-300",
  critical: "bg-red-500/20 text-red-300",
};

function emptyGroup(order: number): ConditionGroup {
  return { group_order: order, description: "", conditions: [] };
}

function emptyCondition(order: number): Condition {
  return { condition_order: order, field_path: "", operator: "eq", value: "" };
}

function normaliseGroups(groups: ConditionGroup[]): ConditionGroup[] {
  return groups.map((g) => ({
    ...g,
    conditions: g.conditions.map((c) => {
      if (NO_VALUE_OPERATORS.has(c.operator)) return { ...c, value: null };
      if (LIST_VALUE_OPERATORS.has(c.operator) && typeof c.value === "string") {
        return { ...c, value: c.value.split(",").map((v) => v.trim()).filter(Boolean) };
      }
      return c;
    }),
  }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("rule_status", statusFilter);
      const res = await apiFetch(`${BASE}/rules?${params.toString()}`, { credentials: "include" });
      if (res.ok) setRules(await res.json());
      else showToast("error", "Failed to load monitoring rules");
    } catch {
      showToast("error", "Failed to load monitoring rules");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const deleteRule = async (r: Rule) => {
    if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`${BASE}/rules/${r.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok || res.status === 204) {
        setRules((prev) => prev.filter((x) => x.id !== r.id));
        if (selected?.id === r.id) setSelected(null);
        showToast("success", "Rule deleted");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Delete failed");
      }
    } catch {
      showToast("error", "Delete failed");
    }
  };

  const toggleStatus = async (r: Rule) => {
    const next: RuleStatus = r.status === "active" ? "inactive" : "active";
    try {
      const res = await apiFetch(`${BASE}/rules/${r.id}/status?new_status=${next}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setRules((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
        showToast("success", `Rule set to ${next}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Status update failed");
      }
    } catch {
      showToast("error", "Status update failed");
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Radar className="w-6 h-6 text-brand-400" /> Monitoring Rules
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              No-code transaction monitoring: condition groups (OR across groups, AND within a group)
              raise alerts when a transaction matches.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setCreating(true)} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> New Rule
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300">
        The rule engine flags transactions for human review only. No rule match constitutes a
        determination of suspicious activity or criminal conduct.
      </div>

      <div className="border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Status — All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Category — All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <div className="text-xs text-slate-500 ml-auto">{rules.length} rule(s)</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="overflow-x-auto rounded-xl border border-navy-700">
          <table className="w-full text-sm">
            <thead className="bg-navy-800 border-b border-navy-700">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Rule</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Severity</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Alerts</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">False +ve</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading…</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No monitoring rules found</td></tr>
              ) : (
                rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium flex items-center gap-2">
                        {r.name}
                        {r.is_system_rule && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-navy-600 rounded px-1.5 py-0.5">system</span>
                        )}
                      </div>
                      {r.rule_ref && <div className="text-xs text-slate-500">{r.rule_ref}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.category.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", SEVERITY_COLOR[r.alert_severity])}>
                        {r.alert_severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[r.status])}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.total_alerts_generated}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {r.false_positive_rate != null ? `${Math.round(r.false_positive_rate * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleStatus(r)} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                          {r.status === "active" ? "Disable" : "Activate"}
                        </button>
                        {!r.is_system_rule && (
                          <button onClick={() => deleteRule(r)} className="text-xs text-red-400 hover:text-red-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(selected || creating) && (
        <RuleDrawer
          rule={selected}
          onClose={() => { setSelected(null); setCreating(false); }}
          onSaved={(r, isNew) => {
            setRules((prev) => (isNew ? [r, ...prev] : prev.map((x) => (x.id === r.id ? r : x))));
            setSelected(r);
            setCreating(false);
            showToast("success", isNew ? "Rule created" : "Rule updated");
          }}
          showToast={showToast}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Drawer (create / edit) ──────────────────────────────────────────────────

function RuleDrawer({
  rule,
  onClose,
  onSaved,
  showToast,
}: {
  rule: Rule | null;
  onClose: () => void;
  onSaved: (r: Rule, isNew: boolean) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}) {
  const isNew = !rule;
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [ruleRef, setRuleRef] = useState(rule?.rule_ref || "");
  const [category, setCategory] = useState(rule?.category || CATEGORIES[0]);
  const [alertType, setAlertType] = useState(rule?.alert_type || "rule_triggered");
  const [severity, setSeverity] = useState(rule?.alert_severity || "medium");
  const [alertScore, setAlertScore] = useState(rule?.alert_score ?? 50);
  const [titleTemplate, setTitleTemplate] = useState(rule?.alert_title_template || "");
  const [lookbackDays, setLookbackDays] = useState<number | "">(rule?.lookback_days ?? "");
  const [lookbackCount, setLookbackCount] = useState<number | "">(rule?.lookback_count ?? "");
  const [groups, setGroups] = useState<ConditionGroup[]>(
    rule?.condition_groups?.length ? rule.condition_groups : [emptyGroup(0)]
  );
  const [saving, setSaving] = useState(false);
  const readOnlySystem = !isNew && rule!.is_system_rule;

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const payload = {
          name, description, rule_ref: ruleRef || undefined, category,
          alert_type: alertType, alert_severity: severity, alert_score: alertScore,
          alert_title_template: titleTemplate || undefined,
          lookback_days: lookbackDays === "" ? undefined : lookbackDays,
          lookback_count: lookbackCount === "" ? undefined : lookbackCount,
          tags: [], applicable_customer_types: [], applicable_payment_methods: [],
          condition_groups: normaliseGroups(groups),
        };
        const res = await apiFetch(`${BASE}/rules`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) onSaved(await res.json(), true);
        else {
          const err = await res.json().catch(() => ({}));
          showToast("error", err.detail || "Create failed");
        }
      } else {
        const payload = {
          name, description, alert_severity: severity, alert_score: alertScore,
          alert_title_template: titleTemplate || undefined,
          lookback_days: lookbackDays === "" ? undefined : lookbackDays,
          lookback_count: lookbackCount === "" ? undefined : lookbackCount,
        };
        const res = await apiFetch(`${BASE}/rules/${rule!.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) onSaved(await res.json(), false);
        else {
          const err = await res.json().catch(() => ({}));
          showToast("error", err.detail || "Save failed");
        }
      }
    } catch {
      showToast("error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">{isNew ? "New monitoring rule" : rule!.rule_ref || rule!.id}</div>
            <h2 className="text-lg font-semibold text-slate-100">{isNew ? "Create Rule" : rule!.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {readOnlySystem && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            This is a system-seeded rule. Category and conditions can&apos;t be changed here — disable it instead
            of deleting if you don&apos;t want it active.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="High-value cross-border transfer" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Rule reference</label>
            <input value={ruleRef} onChange={(e) => setRuleRef(e.target.value)} className="field-input" placeholder="RULE-TM-001" disabled={!isNew} />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="field-input" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input" disabled={!isNew}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Alert type</label>
            <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="field-input" disabled={!isNew}>
              {ALERT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="field-input">
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Alert score (0–100)</label>
            <input type="number" min={0} max={100} value={alertScore} onChange={(e) => setAlertScore(parseFloat(e.target.value) || 0)} className="field-input" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Lookback (days)</label>
            <input type="number" min={0} value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value === "" ? "" : parseInt(e.target.value))} className="field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Lookback count (e.g. more than N transactions)</label>
            <input type="number" min={0} value={lookbackCount} onChange={(e) => setLookbackCount(e.target.value === "" ? "" : parseInt(e.target.value))} className="field-input" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Alert title template</label>
            <input value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} className="field-input" placeholder="High-value transfer to {country}" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500">Conditions (groups below are OR&apos;d together; conditions within a group are AND&apos;d)</label>
            {isNew && (
              <button
                onClick={() => setGroups((g) => [...g, emptyGroup(g.length)])}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add group
              </button>
            )}
          </div>
          {!isNew ? (
            <p className="text-xs text-slate-500">
              Conditions can&apos;t be edited after a rule is created — delete and recreate the rule to change them.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((g, i) => (
                <div key={i}>
                  {i > 0 && <div className="text-xs text-slate-500 mb-1 font-medium">OR</div>}
                  <GroupEditor
                    group={g}
                    onChange={(ng) => setGroups((gs) => gs.map((x, idx) => (idx === i ? ng : x)))}
                    onRemove={() => setGroups((gs) => gs.filter((_, idx) => idx !== i))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving || !name || (isNew && groups.every((g) => g.conditions.length === 0))}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {saving ? "Saving…" : isNew ? "Create Rule" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
  onRemove,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  onRemove: () => void;
}) {
  const updateCondition = (i: number, c: Condition) => {
    onChange({ ...group, conditions: group.conditions.map((x, idx) => (idx === i ? c : x)) });
  };

  return (
    <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={group.description || ""}
          onChange={(e) => onChange({ ...group, description: e.target.value })}
          placeholder="Group label (optional)"
          className="flex-1 bg-transparent border-b border-navy-700 text-xs text-slate-300 px-1 focus:outline-none"
        />
        <button onClick={onRemove} className="text-red-400 hover:text-red-300">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        {group.conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={c.field_path}
              onChange={(e) => updateCondition(i, { ...c, field_path: e.target.value })}
              placeholder="field (e.g. amount_aud)"
              className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 flex-1"
            />
            <select
              value={c.operator}
              onChange={(e) => updateCondition(i, { ...c, operator: e.target.value })}
              className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200"
            >
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {!NO_VALUE_OPERATORS.has(c.operator) && (
              <input
                value={typeof c.value === "string" || typeof c.value === "number" ? c.value : c.value ? JSON.stringify(c.value) : ""}
                onChange={(e) => updateCondition(i, { ...c, value: e.target.value })}
                placeholder={LIST_VALUE_OPERATORS.has(c.operator) ? "comma,separated" : "value"}
                className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 w-32"
              />
            )}
            <button
              onClick={() => onChange({ ...group, conditions: group.conditions.filter((_, idx) => idx !== i) })}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyCondition(group.conditions.length)] })}
          className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Condition
        </button>
      </div>
    </div>
  );
}
