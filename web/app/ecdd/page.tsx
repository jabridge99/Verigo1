"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Plus, Eye, User, Search,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ECDDRecord {
  id: number;
  ecdd_id: string;
  customer_id: number;
  trigger_reason: string;
  pep_status: number;
  adverse_media_found: number;
  beneficial_owner_verified: number;
  source_of_wealth_verified: number;
  enhanced_risk_score: number;
  recommendation?: string;
  analyst_notes?: string;
  status: string;
  created_at?: string;
}

const REC_COLOR: Record<string, string> = {
  approve:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  monitor:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  reject:   "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-slate-500/20 text-slate-300",
  completed: "bg-teal-500/20 text-teal-300",
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-red-400" : s >= 50 ? "text-amber-400" : "text-emerald-400";

const DEMO_RECORDS: ECDDRecord[] = [
  { id: 1, ecdd_id: "ECDD-DEMO00001", customer_id: 3, trigger_reason: "Sanctions screening hit — OFAC SDN list match on transaction counterparty", pep_status: 0, adverse_media_found: 1, beneficial_owner_verified: 0, source_of_wealth_verified: 0, enhanced_risk_score: 70, recommendation: "reject", status: "pending", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, ecdd_id: "ECDD-DEMO00002", customer_id: 2, trigger_reason: "PEP identified — customer declared as foreign politically exposed person", pep_status: 1, adverse_media_found: 0, beneficial_owner_verified: 1, source_of_wealth_verified: 0, enhanced_risk_score: 45, recommendation: "monitor", status: "pending", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, ecdd_id: "ECDD-DEMO00003", customer_id: 1, trigger_reason: "Periodic review — 12-month scheduled ECDD refresh", pep_status: 0, adverse_media_found: 0, beneficial_owner_verified: 1, source_of_wealth_verified: 1, enhanced_risk_score: 0, recommendation: "approve", status: "completed", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 4, ecdd_id: "ECDD-DEMO00004", customer_id: 5, trigger_reason: "Unusual transaction pattern — structuring detected across 3 accounts", pep_status: 0, adverse_media_found: 0, beneficial_owner_verified: 0, source_of_wealth_verified: 1, enhanced_risk_score: 20, recommendation: "monitor", status: "pending", created_at: new Date(Date.now() - 259200000).toISOString() },
];

type Tab = "records" | "create";

export default function ECDDDashboard() {
  const [tab, setTab] = useState<Tab>("records");
  const [records, setRecords] = useState<ECDDRecord[]>(DEMO_RECORDS);
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<ECDDRecord | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/reports/ecdd/`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); if (d.length) setRecords(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const completeECDD = async (ecddId: string) => {
    try { await fetch(`${API}/api/v1/reports/ecdd/${ecddId}/complete`, { method: "PATCH", credentials: "include" }); } catch {}
    setRecords(prev => prev.map(r => r.ecdd_id === ecddId ? { ...r, status: "completed" } : r));
    setSelected(prev => prev?.ecdd_id === ecddId ? { ...prev, status: "completed" } : prev);
    showToast("success", "ECDD marked as completed");
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!search || r.ecdd_id.toLowerCase().includes(q) || r.trigger_reason.toLowerCase().includes(q))
      && (recFilter === "all" || r.recommendation === recFilter)
      && (statusFilter === "all" || r.status === statusFilter);
  });

  const stats = {
    total: records.length,
    pending: records.filter(r => r.status === "pending").length,
    approve: records.filter(r => r.recommendation === "approve").length,
    monitor: records.filter(r => r.recommendation === "monitor").length,
    reject: records.filter(r => r.recommendation === "reject").length,
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Header */}
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Enhanced Customer Due Diligence</h1>
            <p className="text-slate-500 text-sm mt-0.5">ECDD assessments — PEP · Adverse media · Source of wealth</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.pending > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm font-medium">
                <Clock className="w-4 h-4" />{stats.pending} pending
              </div>
            )}
            <button onClick={fetchRecords} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setTab("create")} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> New ECDD
            </button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total",   count: stats.total,   color: "text-slate-200" },
            { label: "Pending", count: stats.pending, color: "text-amber-400" },
            { label: "Approve", count: stats.approve, color: "text-emerald-400" },
            { label: "Monitor", count: stats.monitor, color: "text-amber-400" },
            { label: "Reject",  count: stats.reject,  color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className={`font-bold text-sm ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: "records" as Tab, label: "Records", Icon: ShieldCheck },
            { id: "create" as Tab, label: "New Assessment", Icon: Plus },
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

        {tab === "records" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search ECDD records…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select value={recFilter} onChange={e => setRecFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                {["all","approve","monitor","reject"].map(v => (
                  <option key={v} value={v}>{v === "all" ? "Recommendation — All" : v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                {["all","pending","completed"].map(v => (
                  <option key={v} value={v}>{v === "all" ? "Status — All" : v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-navy-700">
              <table className="w-full text-sm">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">ECDD ID</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Trigger</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Risk Score</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Flags</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Recommendation</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-slate-500">No ECDD records found</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.ecdd_id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.ecdd_id}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-slate-300 text-xs line-clamp-2">{r.trigger_reason}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${SCORE_COLOR(r.enhanced_risk_score)}`}>
                          {r.enhanced_risk_score.toFixed(0)}
                        </span>
                        <span className="text-slate-600 text-xs">/100</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.pep_status ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
                          {r.adverse_media_found ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">Adverse</span> : null}
                          {!r.beneficial_owner_verified ? <span className="px-1.5 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">BO?</span> : null}
                          {!r.source_of_wealth_verified ? <span className="px-1.5 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">SOW?</span> : null}
                          {!r.pep_status && !r.adverse_media_found && r.beneficial_owner_verified && r.source_of_wealth_verified
                            ? <span className="text-slate-600 text-xs">None</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.recommendation && (
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", REC_COLOR[r.recommendation] || "")}>
                            {r.recommendation}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[r.status] || "")}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-AU") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Eye className="w-4 h-4 text-slate-600 hover:text-brand-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {records.length} records</div>
          </div>
        )}

        {tab === "create" && (
          <CreateECDDForm
            onCreated={(r) => {
              setRecords(prev => [r, ...prev]);
              showToast("success", `${r.ecdd_id} created — score ${r.enhanced_risk_score.toFixed(0)}/100`);
              setTab("records");
            }}
          />
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.ecdd_id}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.recommendation && (
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", REC_COLOR[selected.recommendation] || "")}>
                      {selected.recommendation}
                    </span>
                  )}
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[selected.status] || "")}>
                    {selected.status}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
            </div>

            {/* Risk score dial */}
            <div className="rounded-xl bg-navy-900 border border-navy-700 p-4 text-center">
              <div className={`text-5xl font-bold ${SCORE_COLOR(selected.enhanced_risk_score)}`}>
                {selected.enhanced_risk_score.toFixed(0)}
              </div>
              <div className="text-slate-500 text-xs mt-1">Enhanced Risk Score / 100</div>
              <div className="mt-3 h-2 rounded-full bg-navy-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${selected.enhanced_risk_score >= 80 ? "bg-red-500" : selected.enhanced_risk_score >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${selected.enhanced_risk_score}%` }}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Trigger reason</div>
              <div className="text-sm text-slate-300 leading-relaxed">{selected.trigger_reason}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "PEP status", value: selected.pep_status ? "⚠ Yes — PEP identified" : "✓ Not a PEP", ok: !selected.pep_status },
                { label: "Adverse media", value: selected.adverse_media_found ? "⚠ Adverse media found" : "✓ No adverse media", ok: !selected.adverse_media_found },
                { label: "Beneficial owner", value: selected.beneficial_owner_verified ? "✓ Verified" : "✗ Not verified", ok: !!selected.beneficial_owner_verified },
                { label: "Source of wealth", value: selected.source_of_wealth_verified ? "✓ Verified" : "✗ Not verified", ok: !!selected.source_of_wealth_verified },
              ].map(({ label, value, ok }) => (
                <div key={label} className={`rounded-lg p-3 border text-xs ${ok ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                  <div className="text-slate-500 mb-0.5">{label}</div>
                  <div className={ok ? "text-emerald-300" : "text-red-300"}>{value}</div>
                </div>
              ))}
            </div>

            {selected.analyst_notes && (
              <div>
                <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Analyst notes</div>
                <div className="text-sm text-slate-300 leading-relaxed bg-navy-900 rounded-lg p-3 border border-navy-700">{selected.analyst_notes}</div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              Created: {selected.created_at ? new Date(selected.created_at).toLocaleString("en-AU") : "—"}
            </div>

            {/* Score breakdown */}
            <div className="rounded-lg bg-navy-900 border border-navy-700 p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Score breakdown</div>
              {[
                { label: "PEP identified", points: 30, active: !!selected.pep_status },
                { label: "Adverse media", points: 35, active: !!selected.adverse_media_found },
                { label: "BO not verified", points: 20, active: !selected.beneficial_owner_verified },
                { label: "SOW not verified", points: 15, active: !selected.source_of_wealth_verified },
              ].map(({ label, points, active }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-navy-800 last:border-0 text-xs">
                  <span className={active ? "text-slate-200" : "text-slate-600 line-through"}>{label}</span>
                  <span className={active ? "text-red-400 font-medium" : "text-slate-600"}>
                    {active ? `+${points}` : `+0`}
                  </span>
                </div>
              ))}
            </div>

            {selected.status === "pending" && (
              <div className="border-t border-navy-700 pt-4">
                <button
                  onClick={() => completeECDD(selected.ecdd_id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-300 text-sm font-medium hover:bg-teal-500/25 transition-colors w-full justify-center">
                  <CheckCircle className="w-4 h-4" /> Mark Assessment Complete
                </button>
              </div>
            )}
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

function CreateECDDForm({ onCreated }: { onCreated: (r: ECDDRecord) => void }) {
  const [form, setForm] = useState({
    customer_id: 1,
    trigger_reason: "",
    pep_status: 0,
    adverse_media_found: 0,
    adverse_media_details: "",
    beneficial_owner_verified: 0,
    beneficial_owner_details: "",
    source_of_wealth_verified: 0,
    source_of_wealth_details: "",
    analyst_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ score: number; recommendation: string } | null>(null);

  const computePreview = () => {
    let score = 0;
    if (form.pep_status) score += 30;
    if (form.adverse_media_found) score += 35;
    if (!form.beneficial_owner_verified) score += 20;
    if (!form.source_of_wealth_verified) score += 15;
    score = Math.min(score, 100);
    const recommendation = form.adverse_media_found || score >= 80 ? "reject"
      : form.pep_status || score >= 50 ? "monitor" : "approve";
    setPreview({ score, recommendation });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/reports/ecdd/`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated(await res.json());
    } catch {
      let score = 0;
      if (form.pep_status) score += 30;
      if (form.adverse_media_found) score += 35;
      if (!form.beneficial_owner_verified) score += 20;
      if (!form.source_of_wealth_verified) score += 15;
      score = Math.min(score, 100);
      const recommendation = form.adverse_media_found || score >= 80 ? "reject"
        : form.pep_status || score >= 50 ? "monitor" : "approve";
      onCreated({
        id: Date.now(), ecdd_id: `ECDD-${Math.random().toString(36).slice(2,12).toUpperCase()}`,
        customer_id: form.customer_id, trigger_reason: form.trigger_reason,
        pep_status: form.pep_status, adverse_media_found: form.adverse_media_found,
        beneficial_owner_verified: form.beneficial_owner_verified,
        source_of_wealth_verified: form.source_of_wealth_verified,
        enhanced_risk_score: score, recommendation, analyst_notes: form.analyst_notes,
        status: "pending", created_at: new Date().toISOString(),
      });
    } finally { setSubmitting(false); }
  };

  const toggle = (field: string) =>
    setForm(f => ({ ...f, [field]: (f as any)[field] ? 0 : 1 }));

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-6">New ECDD Assessment</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Customer ID *</label>
            <input type="number" required className="field-input" value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Trigger reason *</label>
            <textarea required className="field-input min-h-[80px] resize-none"
              placeholder="e.g. PEP identified during onboarding review…"
              value={form.trigger_reason} onChange={e => setForm(f => ({ ...f, trigger_reason: e.target.value }))} />
          </div>
        </div>

        <div className="card space-y-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Risk Factors</div>

          {[
            { field: "pep_status", label: "PEP identified", desc: "Customer is a politically exposed person", points: 30, warn: true },
            { field: "adverse_media_found", label: "Adverse media found", desc: "Negative news or adverse media coverage identified", points: 35, warn: true },
          ].map(({ field, label, desc, points }) => (
            <div key={field}>
              <div className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                (form as any)[field] ? "bg-red-500/10 border-red-500/30" : "bg-navy-900 border-navy-700 hover:border-navy-600"
              }`} onClick={() => toggle(field)}>
                <div>
                  <div className="text-sm font-medium text-slate-200">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">+{points} pts</span>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${ (form as any)[field] ? "bg-red-500" : "bg-navy-600"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ (form as any)[field] ? "left-5" : "left-0.5"}`} />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {[
            { field: "beneficial_owner_verified", label: "Beneficial owner verified", desc: "UBO chain identified and documented", points: 20 },
            { field: "source_of_wealth_verified", label: "Source of wealth verified", desc: "Customer's source of wealth confirmed with evidence", points: 15 },
          ].map(({ field, label, desc, points }) => (
            <div key={field} className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              (form as any)[field] ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/5 border-red-500/20 hover:border-red-500/30"
            }`} onClick={() => toggle(field)}>
              <div>
                <div className="text-sm font-medium text-slate-200">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">−{points} risk pts if verified</span>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${ (form as any)[field] ? "bg-emerald-500" : "bg-navy-600"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ (form as any)[field] ? "left-5" : "left-0.5"}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card space-y-1">
          <label className="text-xs font-medium text-slate-400">Analyst notes</label>
          <textarea className="field-input min-h-[80px] resize-none" placeholder="Internal notes for compliance file…"
            value={form.analyst_notes} onChange={e => setForm(f => ({ ...f, analyst_notes: e.target.value }))} />
        </div>

        <button type="button" onClick={computePreview}
          className="w-full py-2 rounded-lg border border-navy-600 text-slate-400 text-sm hover:border-brand-500 hover:text-brand-400 transition-colors">
          Preview score
        </button>

        {preview && (
          <div className={`rounded-lg border p-4 text-center ${
            preview.recommendation === "reject" ? "bg-red-500/10 border-red-500/30" :
            preview.recommendation === "monitor" ? "bg-amber-500/10 border-amber-500/30" :
            "bg-emerald-500/10 border-emerald-500/30"
          }`}>
            <div className={`text-3xl font-bold ${SCORE_COLOR(preview.score)}`}>{preview.score}/100</div>
            <div className="text-sm font-medium mt-1 capitalize" style={{ color: preview.recommendation === "reject" ? "#f87171" : preview.recommendation === "monitor" ? "#fbbf24" : "#34d399" }}>
              Recommendation: {preview.recommendation}
            </div>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
          {submitting
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><ShieldCheck className="w-4 h-4" />Create ECDD Assessment</>}
        </button>
      </form>
    </div>
  );
}
