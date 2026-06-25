"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, Plus, X, CheckCircle, AlertTriangle, Clock,
  FileText, CalendarDays, GraduationCap, Scale, Inbox,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API}/api/v1/rule-builder`;

// ── Types ────────────────────────────────────────────────────────────────────

type StepType = "analyst_review" | "compliance_review" | "mlro_review" | "senior_approval";
type DecisionType = "approved" | "rejected" | "more_information" | "escalated";

interface Panel {
  id: string;
  org_id: string;
  transaction_id?: string | null;
  case_id?: string | null;
  customer_id: string;
  risk_summary: {
    customer_risk_score?: number | null;
    customer_risk_level?: string | null;
    transaction_risk_score?: number | null;
    geographic_risk_score?: number | null;
    product_risk_score?: number | null;
    behaviour_risk_score?: number | null;
    risk_matrix_score?: number | null;
    alert_score?: number | null;
    final_approval_score?: number | null;
  };
  triggered_rules: { rule_id: string }[];
  required_actions: { text: string; regulatory_basis?: string }[];
  recommended_actions: { text: string; regulatory_basis?: string }[];
  reporting_obligations: {
    potential_ttr?: boolean | null;
    potential_ifti?: boolean | null;
    potential_smr?: boolean | null;
    rationale: Record<string, string>;
  };
  outstanding_tasks: unknown[];
  missing_documents: unknown[];
  workflow: {
    current_step?: StepType | null;
    is_complete: boolean;
    final_decision?: DecisionType | null;
    final_decision_by?: string | null;
    final_decision_at?: string | null;
    final_decision_notes?: string | null;
  };
  generated_by?: string | null;
  generated_at: string;
  disclaimer: string;
}

interface WorkflowStep {
  id: string;
  step_type: StepType;
  step_order: number;
  decision: DecisionType;
  reviewer_id?: string | null;
  review_notes: string;
  conditions: string[];
  risk_snapshot?: Record<string, unknown> | null;
  reviewed_at: string;
}

const STEP_LABELS: Record<StepType, string> = {
  analyst_review: "Analyst Review",
  compliance_review: "Compliance Review",
  mlro_review: "MLRO Review",
  senior_approval: "Senior Approval",
};

const DECISION_COLOR: Record<DecisionType, string> = {
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
  more_information: "bg-amber-500/20 text-amber-300",
  escalated: "bg-sky-500/20 text-sky-300",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DecisionSupportPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [completeFilter, setCompleteFilter] = useState<string>("open");
  const [selected, setSelected] = useState<Panel | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (completeFilter !== "all") params.set("is_complete", completeFilter === "complete" ? "true" : "false");
    fetch(`${BASE}/decision-support?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPanels)
      .finally(() => setLoading(false));
  }, [completeFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-brand-400" /> Decision Support
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Aggregated risk signals, triggered rules, and reporting obligations — reviewed before approval.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setCreating(true)} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> Generate Panel
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300">
        Decision support panels are workflow guidance only. The system never automatically approves compliance decisions.
      </div>

      <div className="border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <select
            value={completeFilter}
            onChange={(e) => setCompleteFilter(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="open">Open</option>
            <option value="complete">Complete</option>
            <option value="all">All</option>
          </select>
          <div className="text-xs text-slate-500 ml-auto">{panels.length} panel(s)</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="overflow-x-auto rounded-xl border border-navy-700">
          <table className="w-full text-sm">
            <thead className="bg-navy-800 border-b border-navy-700">
              <tr>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Risk</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Reporting</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Step</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Decision</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Generated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">Loading…</td>
                </tr>
              ) : panels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">No decision support panels found</td>
                </tr>
              ) : (
                panels.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelected(p)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium">{p.customer_id}</div>
                      {p.transaction_id && <div className="text-xs text-slate-500">txn {p.transaction_id}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {p.risk_summary.customer_risk_level || "—"}
                      {p.risk_summary.alert_score != null && ` · alert ${p.risk_summary.alert_score.toFixed(0)}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {[
                        p.reporting_obligations.potential_ttr && "TTR",
                        p.reporting_obligations.potential_ifti && "IFTI",
                        p.reporting_obligations.potential_smr && "SMR",
                      ].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {p.workflow.current_step ? STEP_LABELS[p.workflow.current_step] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.workflow.final_decision ? (
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", DECISION_COLOR[p.workflow.final_decision])}>
                          {p.workflow.final_decision.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600/20 text-slate-400">pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.generated_at).toLocaleString("en-AU")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <CreatePanelDrawer
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setPanels((prev) => [p, ...prev]);
            setSelected(p);
            setCreating(false);
            showToast("success", "Decision support panel generated");
          }}
          showToast={showToast}
        />
      )}

      {selected && (
        <PanelDrawer
          panel={selected}
          onClose={() => setSelected(null)}
          onUpdated={(p) => {
            setPanels((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            setSelected(p);
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

// ── Create panel drawer ───────────────────────────────────────────────────────

function CreatePanelDrawer({
  onClose,
  onCreated,
  showToast,
}: {
  onClose: () => void;
  onCreated: (p: Panel) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!customerId) {
      showToast("error", "Customer ID is required");
      return;
    }
    setSaving(true);
    try {
      const params = new URLSearchParams({ customer_id: customerId });
      if (transactionId) params.set("transaction_id", transactionId);
      if (caseId) params.set("case_id", caseId);
      const res = await fetch(`${BASE}/decision-support?${params.toString()}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        onCreated(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Panel generation failed");
      }
    } catch {
      showToast("error", "Panel generation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-navy-900 border-l border-navy-700 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-800">
          <h2 className="text-lg font-semibold text-slate-100">Generate Decision Support Panel</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Customer ID *</label>
            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="field-input" placeholder="cust_..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Transaction ID (optional)</label>
            <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="field-input" placeholder="txn_..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Case ID (optional)</label>
            <input value={caseId} onChange={(e) => setCaseId(e.target.value)} className="field-input" placeholder="case_..." />
          </div>
          <button onClick={create} disabled={saving || !customerId} className="btn-primary w-full justify-center disabled:opacity-50">
            {saving ? "Generating…" : "Generate Panel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel detail drawer ────────────────────────────────────────────────────────

type PanelTab = "summary" | "review" | "history";

function PanelDrawer({
  panel,
  onClose,
  onUpdated,
  showToast,
}: {
  panel: Panel;
  onClose: () => void;
  onUpdated: (p: Panel) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}) {
  const [tab, setTab] = useState<PanelTab>("summary");

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl bg-navy-900 border-l border-navy-700 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Decision Support Panel</h2>
            <p className="text-xs text-slate-500">Customer {panel.customer_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-navy-800">
          {(["summary", "review", "history"] as PanelTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "px-3 py-2 text-sm font-medium capitalize rounded-t-lg",
                tab === t ? "bg-navy-800 text-brand-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "summary" && <SummaryTab panel={panel} />}
          {tab === "review" && <ReviewTab panel={panel} onUpdated={onUpdated} showToast={showToast} />}
          {tab === "history" && <HistoryTab panelId={panel.id} />}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium">{value.toFixed(1)}</span>
    </div>
  );
}

function SummaryTab({ panel }: { panel: Panel }) {
  const r = panel.risk_summary;
  const ro = panel.reporting_obligations;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-navy-700 bg-navy-800 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Risk Summary</h3>
        <ScoreRow label="Customer risk score" value={r.customer_risk_score} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Customer risk level</span>
          <span className="text-slate-200 font-medium capitalize">{r.customer_risk_level || "—"}</span>
        </div>
        <ScoreRow label="Transaction risk" value={r.transaction_risk_score} />
        <ScoreRow label="Geographic risk" value={r.geographic_risk_score} />
        <ScoreRow label="Product risk" value={r.product_risk_score} />
        <ScoreRow label="Behaviour risk" value={r.behaviour_risk_score} />
        <ScoreRow label="Risk matrix score" value={r.risk_matrix_score} />
        <ScoreRow label="Alert score" value={r.alert_score} />
        <ScoreRow label="Final approval score" value={r.final_approval_score} />
      </div>

      <div className="rounded-lg border border-navy-700 bg-navy-800 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Triggered Rules</h3>
        {panel.triggered_rules.length === 0 ? (
          <p className="text-xs text-slate-500">No rules triggered.</p>
        ) : (
          <ul className="text-xs text-slate-400 space-y-1">
            {panel.triggered_rules.map((tr, i) => (
              <li key={i}>{tr.rule_id}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-navy-700 bg-navy-800 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Potential Reporting Obligations</h3>
        <div className="flex gap-2 mb-2">
          {ro.potential_ttr && <span className="badge bg-red-500/20 text-red-300">TTR</span>}
          {ro.potential_ifti && <span className="badge bg-red-500/20 text-red-300">IFTI</span>}
          {ro.potential_smr && <span className="badge bg-red-500/20 text-red-300">SMR</span>}
          {!ro.potential_ttr && !ro.potential_ifti && !ro.potential_smr && (
            <span className="text-xs text-slate-500">None identified.</span>
          )}
        </div>
        {Object.entries(ro.rationale || {}).map(([k, v]) => (
          <p key={k} className="text-xs text-slate-400">
            <span className="uppercase text-slate-500">{k}</span> — {v}
          </p>
        ))}
      </div>

      {(panel.required_actions.length > 0 || panel.recommended_actions.length > 0) && (
        <div className="rounded-lg border border-navy-700 bg-navy-800 p-4 space-y-3">
          {panel.required_actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-300 mb-1">Required Actions</h3>
              <ul className="text-xs text-slate-400 space-y-1">
                {panel.required_actions.map((a, i) => (
                  <li key={i}>{a.text} {a.regulatory_basis && <span className="text-slate-600">({a.regulatory_basis})</span>}</li>
                ))}
              </ul>
            </div>
          )}
          {panel.recommended_actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Recommended Actions</h3>
              <ul className="text-xs text-slate-400 space-y-1">
                {panel.recommended_actions.map((a, i) => (
                  <li key={i}>{a.text} {a.regulatory_basis && <span className="text-slate-600">({a.regulatory_basis})</span>}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-navy-700 bg-navy-800 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Related Workflows</h3>
        <div className="flex flex-wrap gap-2">
          <Link href={`/customers/${panel.customer_id}`} className="btn-secondary text-xs py-1.5 px-3">
            <FileText className="w-3.5 h-3.5" /> Customer
          </Link>
          <Link href="/governance/calendar" className="btn-secondary text-xs py-1.5 px-3">
            <CalendarDays className="w-3.5 h-3.5" /> Compliance Calendar
          </Link>
          <Link href="/governance/training" className="btn-secondary text-xs py-1.5 px-3">
            <GraduationCap className="w-3.5 h-3.5" /> Training Suite
          </Link>
          <Link href="/governance/controls" className="btn-secondary text-xs py-1.5 px-3">
            <Scale className="w-3.5 h-3.5" /> Governance
          </Link>
          <Link href="/reporting" className="btn-secondary text-xs py-1.5 px-3">
            <Inbox className="w-3.5 h-3.5" /> Reporting Queue
          </Link>
        </div>
      </div>

      <div className="text-[11px] text-slate-600">{panel.disclaimer}</div>
    </div>
  );
}

function ReviewTab({
  panel,
  onUpdated,
  showToast,
}: {
  panel: Panel;
  onUpdated: (p: Panel) => void;
  showToast: (type: "success" | "error", msg: string) => void;
}) {
  const [stepType, setStepType] = useState<StepType>(panel.workflow.current_step || "analyst_review");
  const [decision, setDecision] = useState<DecisionType>("approved");
  const [notes, setNotes] = useState("");
  const [conditions, setConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (panel.workflow.is_complete) {
    return (
      <div className="space-y-3">
        <div className={clsx("inline-block px-3 py-1.5 rounded-lg text-sm font-medium capitalize",
          panel.workflow.final_decision && DECISION_COLOR[panel.workflow.final_decision])}>
          {panel.workflow.final_decision?.replace("_", " ")}
        </div>
        <p className="text-sm text-slate-400">{panel.workflow.final_decision_notes}</p>
        <p className="text-xs text-slate-600">
          by {panel.workflow.final_decision_by} at{" "}
          {panel.workflow.final_decision_at && new Date(panel.workflow.final_decision_at).toLocaleString("en-AU")}
        </p>
      </div>
    );
  }

  const submit = async () => {
    if (notes.trim().length < 5) {
      showToast("error", "Review notes must be at least 5 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/decision-support/${panel.id}/review?step_type=${stepType}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          review_notes: notes,
          conditions: conditions.split(",").map((c) => c.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        await res.json();
        const refreshed = await fetch(`${BASE}/decision-support/${panel.id}`, { credentials: "include" }).then((r) => r.json());
        onUpdated(refreshed);
        showToast("success", "Review recorded");
        setNotes("");
        setConditions("");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Review failed");
      }
    } catch {
      showToast("error", "Review failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" /> Current step: {STEP_LABELS[panel.workflow.current_step || "analyst_review"]}
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Review Step</label>
        <select value={stepType} onChange={(e) => setStepType(e.target.value as StepType)} className="field-input">
          {(Object.keys(STEP_LABELS) as StepType[]).map((s) => (
            <option key={s} value={s}>{STEP_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Decision</label>
        <select value={decision} onChange={(e) => setDecision(e.target.value as DecisionType)} className="field-input">
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="more_information">More information needed</option>
          <option value="escalated">Escalated</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Review Notes *</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" rows={3} placeholder="Rationale for this decision…" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Conditions (comma-separated, optional)</label>
        <input value={conditions} onChange={(e) => setConditions(e.target.value)} className="field-input" placeholder="e.g. quarterly review, enhanced monitoring" />
      </div>
      <button onClick={submit} disabled={submitting || notes.trim().length < 5} className="btn-primary w-full justify-center disabled:opacity-50">
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
      <div className="text-[11px] text-slate-600">
        This records a human review decision. The system never automatically approves compliance decisions.
      </div>
    </div>
  );
}

function HistoryTab({ panelId }: { panelId: string }) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/decision-support/${panelId}/workflow-history`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSteps)
      .finally(() => setLoading(false));
  }, [panelId]);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (steps.length === 0) return <div className="text-sm text-slate-500">No review steps recorded yet.</div>;

  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.id} className="rounded-lg border border-navy-700 bg-navy-800 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">{STEP_LABELS[s.step_type]}</span>
            <span className={clsx("px-2 py-0.5 rounded-full font-medium capitalize", DECISION_COLOR[s.decision])}>
              {s.decision.replace("_", " ")}
            </span>
          </div>
          <div className="text-slate-400">{s.review_notes}</div>
          {s.conditions?.length > 0 && (
            <div className="text-slate-500">Conditions: {s.conditions.join(", ")}</div>
          )}
          <div className="text-slate-600">
            {s.reviewer_id} · {new Date(s.reviewed_at).toLocaleString("en-AU")}
          </div>
        </div>
      ))}
    </div>
  );
}
