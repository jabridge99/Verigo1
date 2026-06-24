"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Search, RefreshCw, Download, CheckCircle, AlertTriangle,
  History, ShieldCheck, ArrowRight, Archive,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PolicyType =
  | "aml_ctf_program" | "risk_assessment_methodology" | "cdd_policy" | "edd_policy"
  | "pep_policy" | "beneficial_ownership_policy" | "transaction_monitoring_policy"
  | "sanctions_screening_policy" | "travel_rule_policy" | "reporting_policy"
  | "record_keeping_policy" | "training_policy" | "outsourcing_policy"
  | "whistleblower_policy" | "conflict_of_interest_policy" | "data_privacy_policy"
  | "procedure" | "other";

type PolicyStatus =
  | "draft" | "internal_review" | "compliance_review" | "pending_approval"
  | "published" | "periodic_review" | "superseded" | "archived";

interface Policy {
  id: string;
  policy_number: string;
  title: string;
  policy_type: PolicyType;
  status: PolicyStatus;
  version_major: number;
  version_minor: number;
  effective_date?: string | null;
  review_due_date: string;
  approval_date?: string | null;
  document_owner?: string | null;
  compliance_reviewer?: string | null;
  approver?: string | null;
  summary?: string | null;
  content?: string | null;
  regulatory_references?: string[] | null;
  created_at?: string | null;
}

const TYPE_LABELS: Record<PolicyType, string> = {
  aml_ctf_program: "AML/CTF Program",
  risk_assessment_methodology: "Risk Assessment Methodology",
  cdd_policy: "CDD Policy",
  edd_policy: "EDD Policy",
  pep_policy: "PEP Policy",
  beneficial_ownership_policy: "Beneficial Ownership Policy",
  transaction_monitoring_policy: "Transaction Monitoring Policy",
  sanctions_screening_policy: "Sanctions Screening Policy",
  travel_rule_policy: "Travel Rule Policy",
  reporting_policy: "Reporting Policy (SMR/TTR/IFTI)",
  record_keeping_policy: "Record Keeping Policy",
  training_policy: "Training Policy",
  outsourcing_policy: "Outsourcing Policy",
  whistleblower_policy: "Whistleblower Policy",
  conflict_of_interest_policy: "Conflict of Interest Policy",
  data_privacy_policy: "Data Privacy Policy",
  procedure: "Procedure",
  other: "Other",
};

const STATUS_COLOR: Record<PolicyStatus, string> = {
  draft: "bg-slate-500/20 text-slate-300",
  internal_review: "bg-brand-500/20 text-brand-300",
  compliance_review: "bg-brand-500/20 text-brand-300",
  pending_approval: "bg-amber-500/20 text-amber-300",
  published: "bg-emerald-500/20 text-emerald-300",
  periodic_review: "bg-amber-500/20 text-amber-300",
  superseded: "bg-slate-600/20 text-slate-500",
  archived: "bg-slate-600/20 text-slate-500",
};

const NEXT_ACTIONS: Record<PolicyStatus, { action: string; label: string }[]> = {
  draft: [{ action: "submit_for_review", label: "Submit for Internal Review" }],
  internal_review: [{ action: "submit_for_compliance", label: "Submit for Compliance Review" }],
  compliance_review: [{ action: "submit_for_approval", label: "Submit for Approval" }],
  pending_approval: [
    { action: "publish", label: "Publish" },
    { action: "request_changes", label: "Request Changes" },
  ],
  published: [
    { action: "trigger_periodic_review", label: "Trigger Periodic Review" },
    { action: "archive", label: "Archive" },
  ],
  periodic_review: [
    { action: "publish", label: "Re-publish" },
    { action: "supersede", label: "Mark Superseded" },
  ],
  superseded: [{ action: "archive", label: "Archive" }],
  archived: [],
};

const DEMO_POLICIES: Policy[] = [
  { id: "gp_1", policy_number: "AML-POL-001", title: "AML/CTF Program — Master Policy", policy_type: "aml_ctf_program", status: "published", version_major: 2, version_minor: 1, review_due_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), summary: "Top-level program document governing the entity's AML/CTF obligations.", created_at: new Date().toISOString() },
  { id: "gp_2", policy_number: "CDD-POL-001", title: "Customer Due Diligence Policy", policy_type: "cdd_policy", status: "pending_approval", version_major: 1, version_minor: 2, review_due_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10), summary: "Identification and verification standards for customer onboarding.", created_at: new Date().toISOString() },
  { id: "gp_3", policy_number: "TM-POL-001", title: "Transaction Monitoring Policy", policy_type: "transaction_monitoring_policy", status: "draft", version_major: 1, version_minor: 0, review_due_date: new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10), summary: "Rule thresholds, escalation, and alert handling standards.", created_at: new Date().toISOString() },
  { id: "gp_4", policy_number: "PEP-POL-001", title: "PEP Identification & Management Policy", policy_type: "pep_policy", status: "periodic_review", version_major: 1, version_minor: 3, review_due_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), summary: "Identification, EDD, and ongoing monitoring of politically exposed persons.", created_at: new Date().toISOString() },
  { id: "gp_5", policy_number: "TRAIN-POL-001", title: "AML/CTF Training Policy", policy_type: "training_policy", status: "published", version_major: 1, version_minor: 1, review_due_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10), summary: "Mandatory induction and annual refresher training requirements.", created_at: new Date().toISOString() },
];

type Tab = "list" | "create";

export default function PoliciesPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [policies, setPolicies] = useState<Policy[]>(DEMO_POLICIES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/governance/policies`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); if (d.length) setPolicies(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const fetchVersions = async (policyId: string) => {
    try {
      const res = await fetch(`${API}/api/v1/governance/policies/${policyId}/versions`, { credentials: "include" });
      if (res.ok) setVersions(await res.json());
      else setVersions([]);
    } catch { setVersions([]); }
  };

  const openPolicy = (p: Policy) => { setSelected(p); fetchVersions(p.id); };

  const runWorkflowAction = async (policy: Policy, action: string) => {
    try {
      const res = await fetch(`${API}/api/v1/governance/policies/${policy.id}/workflow`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPolicies(prev => prev.map(p => p.id === policy.id ? updated : p));
        setSelected(updated);
        showToast("success", `Policy moved to ${updated.status.replace("_", " ")}`);
        return;
      }
    } catch {}
    // Demo fallback — apply the transition locally
    const STATUS_MAP: Record<string, PolicyStatus> = {
      submit_for_review: "internal_review",
      submit_for_compliance: "compliance_review",
      submit_for_approval: "pending_approval",
      request_changes: "internal_review",
      publish: "published",
      trigger_periodic_review: "periodic_review",
      supersede: "superseded",
      archive: "archived",
    };
    const newStatus = STATUS_MAP[action] ?? policy.status;
    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, status: newStatus } : p));
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
    showToast("success", `Policy moved to ${newStatus.replace("_", " ")}`);
  };

  const exportPdf = (policy: Policy) => {
    window.open(`${API}/api/v1/governance/policies/${policy.id}/export-html`, "_blank");
  };

  const filtered = policies.filter(p => {
    const q = search.toLowerCase();
    return (!search || p.title.toLowerCase().includes(q) || p.policy_number.toLowerCase().includes(q))
      && (statusFilter === "all" || p.status === statusFilter);
  });

  const stats = {
    total: policies.length,
    published: policies.filter(p => p.status === "published").length,
    pendingApproval: policies.filter(p => p.status === "pending_approval").length,
    overdueReview: policies.filter(p => new Date(p.review_due_date) < new Date() && p.status === "published").length,
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Governance Policies</h1>
            <p className="text-slate-500 text-sm mt-0.5">AML/CTF policy register — create, review, approve, version, archive</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPolicies} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setTab("create")} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> New Policy
            </button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total", count: stats.total, color: "text-slate-200" },
            { label: "Published", count: stats.published, color: "text-emerald-400" },
            { label: "Pending Approval", count: stats.pendingApproval, color: "text-amber-400" },
            { label: "Overdue Review", count: stats.overdueReview, color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className={`font-bold text-sm ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: "list" as Tab, label: "Register", Icon: FileText },
            { id: "create" as Tab, label: "New Policy", Icon: Plus },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "list" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search policies…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="all">Status — All</option>
                {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-navy-700">
              <table className="w-full text-sm">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Policy No.</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Version</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Review Due</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No policies found</td></tr>
                  ) : filtered.map(p => {
                    const overdue = new Date(p.review_due_date) < new Date() && p.status === "published";
                    return (
                      <tr key={p.id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => openPolicy(p)}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.policy_number}</td>
                        <td className="px-4 py-3 text-slate-200">{p.title}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{TYPE_LABELS[p.policy_type]}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.version_major}.{p.version_minor}</td>
                        <td className="px-4 py-3">
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[p.status])}>
                            {p.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className={clsx("px-4 py-3 text-xs", overdue ? "text-red-400 font-medium" : "text-slate-500")}>
                          {new Date(p.review_due_date).toLocaleDateString("en-AU")}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={e => { e.stopPropagation(); exportPdf(p); }} title="Export PDF"
                            className="text-slate-500 hover:text-brand-400 transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {policies.length} policies</div>
          </div>
        )}

        {tab === "create" && (
          <CreatePolicyForm onCreated={(p) => {
            setPolicies(prev => [p, ...prev]);
            showToast("success", `${p.policy_number} created as draft`);
            setTab("list");
          }} />
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.policy_number} · v{selected.version_major}.{selected.version_minor}</div>
                <h2 className="text-lg font-semibold text-slate-100">{selected.title}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => exportPdf(selected)} title="Export PDF" className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-brand-400 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
              </div>
            </div>

            <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[selected.status])}>
              {selected.status.replace("_", " ")}
            </span>

            {selected.summary && (
              <div>
                <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Summary</div>
                <div className="text-sm text-slate-300 leading-relaxed">{selected.summary}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Review due</div>
                <div className="text-slate-200">{new Date(selected.review_due_date).toLocaleDateString("en-AU")}</div>
              </div>
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Effective date</div>
                <div className="text-slate-200">{selected.effective_date ? new Date(selected.effective_date).toLocaleDateString("en-AU") : "—"}</div>
              </div>
            </div>

            <div className="border-t border-navy-700 pt-4 space-y-2">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> Workflow actions
              </div>
              <div className="flex flex-wrap gap-2">
                {(NEXT_ACTIONS[selected.status] || []).map(({ action, label }) => (
                  <button key={action} onClick={() => runWorkflowAction(selected, action)}
                    className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      action === "archive"
                        ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        : "border-brand-500/30 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20")}>
                    {action === "archive" ? <Archive className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {label}
                  </button>
                ))}
                {(NEXT_ACTIONS[selected.status] || []).length === 0 && (
                  <div className="text-xs text-slate-600">No further transitions available</div>
                )}
              </div>
            </div>

            <div className="border-t border-navy-700 pt-4 space-y-2">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Version history
              </div>
              {versions.length === 0 ? (
                <div className="text-xs text-slate-600">No published versions yet</div>
              ) : versions.map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs border-b border-navy-800 last:border-0 py-1.5">
                  <span className="text-slate-300">v{v.version_label || `${v.version_major}.${v.version_minor}`}</span>
                  <span className="text-slate-500">{v.change_type || "—"}</span>
                  <span className="text-slate-500">{v.approved_at ? new Date(v.approved_at).toLocaleDateString("en-AU") : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function CreatePolicyForm({ onCreated }: { onCreated: (p: Policy) => void }) {
  const [form, setForm] = useState({
    title: "",
    policy_type: "cdd_policy" as PolicyType,
    summary: "",
    scope: "",
    content: "",
    review_due_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    document_owner: "",
    regulatory_references: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const buildPolicy = (): Policy => ({
    id: `gp_${Date.now()}`,
    policy_number: `POL-${Math.floor(Math.random() * 900 + 100)}`,
    title: form.title,
    policy_type: form.policy_type,
    status: "draft",
    version_major: 1,
    version_minor: 0,
    review_due_date: form.review_due_date,
    summary: form.summary,
    content: form.content,
    regulatory_references: form.regulatory_references.split(",").map(s => s.trim()).filter(Boolean),
    created_at: new Date().toISOString(),
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/governance/policies`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          regulatory_references: form.regulatory_references.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated(await res.json());
    } catch {
      onCreated(buildPolicy());
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">New Governance Policy</h2>
      <p className="text-slate-500 text-sm mb-6">Create a new policy document — starts in draft, routes through internal review, compliance review, and approval before publishing.</p>

      <div className="card space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Title *</label>
          <input className="field-input" placeholder="e.g. Customer Due Diligence Policy"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Policy type *</label>
          <select className="field-input" value={form.policy_type}
            onChange={e => setForm(f => ({ ...f, policy_type: e.target.value as PolicyType }))}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Summary</label>
          <textarea className="field-input min-h-[70px] resize-none" placeholder="Executive summary / purpose statement…"
            value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Scope</label>
          <textarea className="field-input min-h-[60px] resize-none" placeholder="Who/what this policy applies to…"
            value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Policy content</label>
          <textarea className="field-input min-h-[140px] resize-none" placeholder="Full policy text…"
            value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Review due date *</label>
            <input type="date" className="field-input" value={form.review_due_date}
              onChange={e => setForm(f => ({ ...f, review_due_date: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Document owner (user ID) *</label>
            <input className="field-input" placeholder="user_id"
              value={form.document_owner} onChange={e => setForm(f => ({ ...f, document_owner: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Regulatory references</label>
          <input className="field-input" placeholder="AML/CTF Act s.84, FATF R.10 (comma separated)"
            value={form.regulatory_references} onChange={e => setForm(f => ({ ...f, regulatory_references: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <button type="button" disabled={!form.title || submitting} onClick={handleSubmit} className="btn-primary disabled:opacity-40">
          {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Create Policy</>}
        </button>
      </div>
    </div>
  );
}
