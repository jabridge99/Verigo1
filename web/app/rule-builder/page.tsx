"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Workflow, Plus, RefreshCw, Trash2, Play, History, FileClock,
  CheckCircle, AlertTriangle, ChevronDown, ChevronRight, X, Beaker,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1/rule-builder`;

// ── Types ────────────────────────────────────────────────────────────────────

type RuleStatus = "active" | "inactive" | "testing" | "archived";

interface Condition {
  field: string;
  operator: string;
  value: unknown;
  value_label?: string | null;
  negate: boolean;
}

interface ConditionGroup {
  logic: "AND" | "OR";
  description?: string | null;
  negate: boolean;
  conditions: Condition[];
  groups: ConditionGroup[];
}

interface Action {
  action_type: string;
  params: Record<string, unknown>;
  delay_minutes: number;
  description?: string | null;
}

interface Rule {
  id: string;
  rule_ref: string;
  name: string;
  description?: string | null;
  event_type: string;
  status: RuleStatus;
  is_system: boolean;
  priority: number;
  condition_groups: ConditionGroup[];
  actions: Action[];
  applicable_industries: string[];
  tags: string[];
  trigger_count: number;
  last_triggered_at?: string | null;
  last_executed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface Reference {
  event_types: { value: string; label: string }[];
  action_types: { value: string; label: string }[];
  operators: { value: string; label: string }[];
  condition_fields: Record<string, string[]>;
  action_params_reference: Record<string, { required?: string[]; optional?: string[]; note?: string }>;
  disclaimer: string;
}

const STATUS_COLOR: Record<RuleStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  inactive: "bg-slate-600/20 text-slate-400",
  testing: "bg-amber-500/20 text-amber-300",
  archived: "bg-slate-700/30 text-slate-500",
};

function emptyGroup(): ConditionGroup {
  return { logic: "AND", negate: false, conditions: [], groups: [] };
}

function emptyAction(actionType: string): Action {
  return { action_type: actionType, params: {}, delay_minutes: 0, description: "" };
}

const LIST_VALUE_OPERATORS = new Set(["in", "not_in", "between"]);

// The condition value editor stores list-valued operators (in/not_in/between)
// as a comma-separated string for simple text input; convert to an array
// before sending to the backend, which expects a real list (e.g. [min, max]
// for "between").
function normaliseGroupValues(group: ConditionGroup): ConditionGroup {
  return {
    ...group,
    conditions: group.conditions.map((c) =>
      LIST_VALUE_OPERATORS.has(c.operator) && typeof c.value === "string"
        ? { ...c, value: c.value.split(",").map((v) => v.trim()).filter(Boolean) }
        : c
    ),
    groups: group.groups.map(normaliseGroupValues),
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type DetailTab = "edit" | "test" | "executions" | "versions";

export default function RuleBuilderPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [reference, setReference] = useState<Reference | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, refRes] = await Promise.all([
        fetch(`${BASE}/rules`, { credentials: "include" }),
        fetch(`${BASE}/rules/reference`, { credentials: "include" }),
      ]);
      if (rRes.ok) setRules(await rRes.json());
      if (refRes.ok) setReference(await refRes.json());
    } catch {
      showToast("error", "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = rules.filter(
    (r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (eventFilter === "all" || r.event_type === eventFilter)
  );

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    try {
      const res = await fetch(`${BASE}/rules/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok || res.status === 204) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        if (selected?.id === id) setSelected(null);
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
      const res = await fetch(`${BASE}/rules/${r.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRules((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
        showToast("success", `Rule set to ${next}`);
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
              <Workflow className="w-6 h-6 text-brand-400" /> Rule Builder
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Event-driven automation: IF / AND / OR / NOT conditions trigger workflow actions.
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

      {reference && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300">
          {reference.disclaimer}
        </div>
      )}

      <div className="border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Status — All</option>
            {Object.keys(STATUS_COLOR).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="all">Event — All</option>
            {reference?.event_types.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-500 ml-auto">{filtered.length} rule(s)</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="overflow-x-auto rounded-xl border border-navy-700">
          <table className="w-full text-sm">
            <thead className="bg-navy-800 border-b border-navy-700">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Rule</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Event</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Priority</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Triggers</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No rules found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.rule_ref}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {reference?.event_types.find((e) => e.value === r.event_type)?.label || r.event_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.priority}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[r.status])}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.trigger_count}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleStatus(r)}
                          className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                        >
                          {r.status === "active" ? "Disable" : "Activate"}
                        </button>
                        {!r.is_system && (
                          <button
                            onClick={() => deleteRule(r.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
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

      {(selected || creating) && reference && (
        <RuleDrawer
          rule={selected}
          reference={reference}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
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

// ── Drawer (create/edit + test + history) ───────────────────────────────────

function RuleDrawer({
  rule,
  reference,
  onClose,
  onSaved,
  showToast,
}: {
  rule: Rule | null;
  reference: Reference;
  onClose: () => void;
  onSaved: (r: Rule, isNew: boolean) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}) {
  const isNew = !rule;
  const [tab, setTab] = useState<DetailTab>("edit");

  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [eventType, setEventType] = useState(rule?.event_type || reference.event_types[0]?.value || "");
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [status, setStatus] = useState<RuleStatus>(rule?.status || "active");
  const [groups, setGroups] = useState<ConditionGroup[]>(
    rule?.condition_groups?.length ? rule.condition_groups : [emptyGroup()]
  );
  const [actions, setActions] = useState<Action[]>(
    rule?.actions?.length ? rule.actions : [emptyAction(reference.action_types[0]?.value || "create_alert")]
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        event_type: eventType,
        priority,
        condition_groups: groups.map(normaliseGroupValues),
        actions,
        ...(isNew ? {} : { status }),
      };
      const res = await fetch(isNew ? `${BASE}/rules` : `${BASE}/rules/${rule!.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        onSaved(saved, isNew);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Save failed");
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
        className="w-full max-w-3xl bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">{isNew ? "New automation rule" : rule!.rule_ref}</div>
            <h2 className="text-lg font-semibold text-slate-100">{isNew ? "Create Rule" : rule!.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isNew && (
          <div className="flex gap-1 border-b border-navy-700">
            {([
              ["edit", "Edit", Workflow],
              ["test", "Test", Beaker],
              ["executions", "Executions", FileClock],
              ["versions", "History", History],
            ] as [DetailTab, string, typeof Workflow][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  tab === id ? "border-brand-500 text-brand-300" : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        )}

        {(isNew || tab === "edit") && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="High-risk PEP onboarding alert" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Priority (lower = first)</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                  className="field-input"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="field-input" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Event</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="field-input">
                  {reference.event_types.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              {!isNew && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as RuleStatus)} className="field-input">
                    {Object.keys(STATUS_COLOR).map((s) => (
                      <option key={s} value={s}>
                        {s} {s === "testing" ? "(shadow mode — logs only)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500">Conditions (top-level groups are OR'd together)</label>
                <button
                  onClick={() => setGroups((g) => [...g, emptyGroup()])}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add group
                </button>
              </div>
              <div className="space-y-3">
                {groups.map((g, i) => (
                  <div key={i} className="relative">
                    {i > 0 && <div className="text-xs text-slate-500 mb-1 font-medium">OR</div>}
                    <GroupEditor
                      group={g}
                      reference={reference}
                      onChange={(ng) => setGroups((gs) => gs.map((x, idx) => (idx === i ? ng : x)))}
                      onRemove={() => setGroups((gs) => gs.filter((_, idx) => idx !== i))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500">Actions (executed in order when conditions match)</label>
                <button
                  onClick={() => setActions((a) => [...a, emptyAction(reference.action_types[0]?.value || "create_alert")])}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add action
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <ActionEditor
                    key={i}
                    action={a}
                    reference={reference}
                    onChange={(na) => setActions((as) => as.map((x, idx) => (idx === i ? na : x)))}
                    onRemove={() => setActions((as) => as.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            </div>

            <button onClick={save} disabled={saving || !name || actions.length === 0} className="btn-primary w-full justify-center disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create Rule" : "Save Changes"}
            </button>
          </div>
        )}

        {!isNew && tab === "test" && <TestPanel rule={rule!} />}
        {!isNew && tab === "executions" && <ExecutionsPanel ruleId={rule!.id} />}
        {!isNew && tab === "versions" && <VersionsPanel ruleId={rule!.id} />}
      </div>
    </div>
  );
}

// ── Condition group editor (recursive — supports nesting/AND/OR/NOT) ────────

function GroupEditor({
  group,
  reference,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: ConditionGroup;
  reference: Reference;
  onChange: (g: ConditionGroup) => void;
  onRemove: () => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const allFields = Object.values(reference.condition_fields).flat();

  const updateCondition = (i: number, c: Condition) => {
    onChange({ ...group, conditions: group.conditions.map((x, idx) => (idx === i ? c : x)) });
  };

  return (
    <div className={clsx("rounded-lg border border-navy-700 bg-navy-900/60 p-3", depth > 0 && "ml-4")}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setOpen((o) => !o)} className="text-slate-500">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <select
          value={group.logic}
          onChange={(e) => onChange({ ...group, logic: e.target.value as "AND" | "OR" })}
          className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200"
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input type="checkbox" checked={group.negate} onChange={(e) => onChange({ ...group, negate: e.target.checked })} />
          NOT (invert this group)
        </label>
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

      {open && (
        <div className="space-y-2">
          {group.conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={c.negate}
                  onChange={(e) => updateCondition(i, { ...c, negate: e.target.checked })}
                />
                NOT
              </label>
              <select
                value={c.field}
                onChange={(e) => updateCondition(i, { ...c, field: e.target.value })}
                className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 flex-1"
              >
                <option value="">field…</option>
                {allFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                value={c.operator}
                onChange={(e) => updateCondition(i, { ...c, operator: e.target.value })}
                className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="">op…</option>
                {reference.operators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!["is_true", "is_false", "is_null"].includes(c.operator) && (
                <input
                  value={typeof c.value === "string" || typeof c.value === "number" ? c.value : c.value ? JSON.stringify(c.value) : ""}
                  onChange={(e) => updateCondition(i, { ...c, value: e.target.value })}
                  placeholder="value"
                  className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 w-28"
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

          <div className="flex gap-3 pt-1">
            <button
              onClick={() =>
                onChange({
                  ...group,
                  conditions: [...group.conditions, { field: "", operator: "eq", value: "", negate: false }],
                })
              }
              className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Condition
            </button>
            <button
              onClick={() => onChange({ ...group, groups: [...group.groups, emptyGroup()] })}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nested group
            </button>
          </div>

          {group.groups.length > 0 && (
            <div className="space-y-2 pt-1">
              {group.groups.map((sg, i) => (
                <GroupEditor
                  key={i}
                  group={sg}
                  reference={reference}
                  depth={depth + 1}
                  onChange={(ng) => onChange({ ...group, groups: group.groups.map((x, idx) => (idx === i ? ng : x)) })}
                  onRemove={() => onChange({ ...group, groups: group.groups.filter((_, idx) => idx !== i) })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action editor ────────────────────────────────────────────────────────────

function ActionEditor({
  action,
  reference,
  onChange,
  onRemove,
}: {
  action: Action;
  reference: Reference;
  onChange: (a: Action) => void;
  onRemove: () => void;
}) {
  const ref = reference.action_params_reference[action.action_type];
  const [paramsText, setParamsText] = useState(JSON.stringify(action.params || {}, null, 0));

  return (
    <div className="rounded-lg border border-navy-700 bg-navy-900/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={action.action_type}
          onChange={(e) => onChange({ ...action, action_type: e.target.value })}
          className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 flex-1"
        >
          {reference.action_types.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={action.delay_minutes}
          onChange={(e) => onChange({ ...action, delay_minutes: parseInt(e.target.value) || 0 })}
          className="bg-navy-800 border border-navy-600 rounded px-2 py-1 text-xs text-slate-200 w-20"
          title="Delay (minutes)"
        />
        <button onClick={onRemove} className="text-red-400 hover:text-red-300">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {ref && (
        <div className="text-[11px] text-slate-500">
          {ref.required?.length ? <>Required params: {ref.required.join(", ")}. </> : null}
          {ref.optional?.length ? <>Optional: {ref.optional.join(", ")}. </> : null}
          {ref.note ? <span className="text-amber-400">{ref.note}</span> : null}
        </div>
      )}
      <textarea
        value={paramsText}
        onChange={(e) => {
          setParamsText(e.target.value);
          try {
            onChange({ ...action, params: JSON.parse(e.target.value) });
          } catch {
            // invalid JSON while typing — ignore until valid
          }
        }}
        rows={2}
        className="field-input font-mono text-xs"
        placeholder='{"severity": "high", "title": "..."}'
      />
    </div>
  );
}

// ── Test (dry-run) panel ─────────────────────────────────────────────────────

function TestPanel({ rule }: { rule: Rule }) {
  const [context, setContext] = useState('{\n  "customer": {\n    "risk_level": "high"\n  }\n}');
  const [result, setResult] = useState<{
    matched: boolean;
    matched_group_index: number | null;
    would_execute_actions: Action[];
    disclaimer: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(context);
    } catch {
      setError("Context must be valid JSON");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch(`${BASE}/rules/${rule.id}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: parsed }),
      });
      if (res.ok) setResult(await res.json());
      else setError("Test failed");
    } catch {
      setError("Test failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Dry-run this rule&apos;s conditions against a sample event context. No actions are executed and nothing is logged.
      </p>
      <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={8} className="field-input font-mono text-xs" />
      <button onClick={run} disabled={running} className="btn-secondary text-sm py-2 px-4 disabled:opacity-50">
        <Play className="w-4 h-4" /> {running ? "Running…" : "Run test"}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {result && (
        <div className="rounded-lg border border-navy-700 bg-navy-900 p-3 space-y-2">
          <div className={clsx("text-sm font-medium", result.matched ? "text-emerald-400" : "text-slate-400")}>
            {result.matched ? `Matched (group ${result.matched_group_index})` : "No match"}
          </div>
          {result.matched && (
            <div className="text-xs text-slate-400">
              Would execute: {result.would_execute_actions.map((a) => a.action_type).join(", ")}
            </div>
          )}
          <div className="text-[11px] text-slate-600">{result.disclaimer}</div>
        </div>
      )}
    </div>
  );
}

// ── Executions panel ──────────────────────────────────────────────────────────

interface Execution {
  id: string;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  conditions_matched: boolean;
  actions_executed: { action_type: string; result?: string }[];
  is_shadow_mode: boolean;
  execution_time_ms?: number | null;
  error_message?: string | null;
  executed_at: string;
}

function ExecutionsPanel({ ruleId }: { ruleId: string }) {
  const [execs, setExecs] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/rules/${ruleId}/executions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setExecs)
      .finally(() => setLoading(false));
  }, [ruleId]);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (execs.length === 0) return <div className="text-sm text-slate-500">No executions yet.</div>;

  return (
    <div className="space-y-2">
      {execs.map((e) => (
        <div key={e.id} className="rounded-lg border border-navy-700 bg-navy-900 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className={clsx("font-medium", e.conditions_matched ? "text-emerald-400" : "text-slate-500")}>
              {e.conditions_matched ? "Matched" : "No match"}
            </span>
            <span className="text-slate-500">{new Date(e.executed_at).toLocaleString("en-AU")}</span>
          </div>
          <div className="text-slate-500">
            {e.entity_type} {e.entity_id} {e.is_shadow_mode && <span className="text-amber-400">(shadow mode)</span>}
          </div>
          {e.actions_executed?.length > 0 && (
            <div className="text-slate-400">
              Actions: {e.actions_executed.map((a) => `${a.action_type}${a.result ? ` (${a.result})` : ""}`).join(", ")}
            </div>
          )}
          {e.error_message && <div className="text-red-400">{e.error_message}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Versions panel ────────────────────────────────────────────────────────────

interface Version {
  id: string;
  version_number: number;
  name: string;
  status: string;
  change_summary?: string | null;
  changed_by?: string | null;
  created_at: string;
}

function VersionsPanel({ ruleId }: { ruleId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/rules/${ruleId}/versions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setVersions)
      .finally(() => setLoading(false));
  }, [ruleId]);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (versions.length === 0) return <div className="text-sm text-slate-500">No version history yet.</div>;

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="rounded-lg border border-navy-700 bg-navy-900 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">v{v.version_number} — {v.status}</span>
            <span className="text-slate-500">{new Date(v.created_at).toLocaleString("en-AU")}</span>
          </div>
          <div className="text-slate-400">{v.change_summary}</div>
        </div>
      ))}
    </div>
  );
}
