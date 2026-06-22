"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, AlertTriangle, Clock, CheckCircle, Send,
  RefreshCw, Search, Plus, Eye, ChevronRight, Zap, Download, User,
} from "lucide-react";
import clsx from "clsx";
import QuickActions from "@/components/QuickActions";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Report {
  id: number;
  report_id: string;
  industry_id?: string;
  customer_id: number;
  report_type: string;
  status: string;
  priority?: string;
  title: string;
  summary: string;
  findings?: string;
  narrative?: string;
  risk_level?: string;
  total_amount_flagged: number;
  transaction_count: number;
  austrac_report_type?: string;
  due_date?: string;
  days_remaining?: number;
  prepared_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  mlro_sign_off?: boolean;
  submitted_to?: string;
  submission_reference?: string;
  alert_ids?: string[];
  created_at?: string;
  submitted_at?: string;
}

interface Summary {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  overdue: number;
  due_soon: number;
  submitted: number;
  draft: number;
  under_review: number;
}

const TYPE_LABELS: Record<string, string> = {
  ttr:      "TTR — Threshold Transaction",
  ifti_in:  "IFTI-I — Inbound Transfer",
  ifti_out: "IFTI-E — Outbound Transfer",
  smr:      "SMR — Suspicious Matter",
  ecdd:     "ECDD — Enhanced Due Diligence",
  sar:      "SAR — Suspicious Activity",
  ctr:      "CTR — Currency Transaction",
};

const TYPE_COLOR: Record<string, string> = {
  ttr:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ifti_in:  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  ifti_out: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  smr:      "bg-red-500/20 text-red-300 border-red-500/30",
  ecdd:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  sar:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
  ctr:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const STATUS_COLOR: Record<string, string> = {
  draft:        "bg-slate-500/20 text-slate-300",
  under_review: "bg-purple-500/20 text-purple-300",
  approved:     "bg-emerald-500/20 text-emerald-300",
  submitted:    "bg-brand-500/20 text-brand-300",
  acknowledged: "bg-teal-500/20 text-teal-300",
  rejected:     "bg-red-500/20 text-red-300",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400",
  high:   "text-orange-400",
  medium: "text-amber-400",
  low:    "text-slate-400",
};

const STATUTORY_INFO: Record<string, { deadline: string; obligation: string; form: string }> = {
  ttr:      { deadline: "10 business days", obligation: "AML/CTF Act 2006 s.43", form: "AUSTRAC Online — TTR" },
  ifti_in:  { deadline: "10 business days", obligation: "AML/CTF Act 2006 s.45", form: "AUSTRAC Online — IFTI-I" },
  ifti_out: { deadline: "10 business days", obligation: "AML/CTF Act 2006 s.45", form: "AUSTRAC Online — IFTI-E" },
  smr:      { deadline: "3 business days",  obligation: "AML/CTF Act 2006 s.41", form: "AUSTRAC Online — SMR" },
};

const DEMO_REPORTS: Report[] = [
  { id: 1, report_id: "RPT-DEMO00001", customer_id: 3, report_type: "smr", status: "draft", priority: "urgent", title: "SMR — Ivan Petrov — Sanctions Match", summary: "Suspicious matter identified involving Ivan Petrov. Alert type: sanctions match. Transaction amount: AUD $15,000.00.", austrac_report_type: "SMR", due_date: new Date(Date.now() + 86400000).toISOString(), days_remaining: 1, total_amount_flagged: 15000, transaction_count: 1, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, report_id: "RPT-DEMO00002", customer_id: 2, report_type: "ttr", status: "under_review", priority: "high", title: "TTR — Acme Pty Ltd — AUD $45,000.00", summary: "Cash transaction of AUD $45,000.00 meets the threshold reporting obligation under the AML/CTF Act 2006 s.43.", austrac_report_type: "TTR", due_date: new Date(Date.now() + 432000000).toISOString(), days_remaining: 5, total_amount_flagged: 45000, transaction_count: 1, reviewed_by: "compliance@firm.com.au", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, report_id: "RPT-DEMO00003", customer_id: 1, report_type: "ifti_out", status: "approved", priority: "medium", title: "IFTI-E — Jane Smith — IR", summary: "Outbound international funds transfer of AUD $8,500.00 sent by Jane Smith to IR triggers IFTI reporting obligation.", austrac_report_type: "IFTI-E", due_date: new Date(Date.now() + 604800000).toISOString(), days_remaining: 7, total_amount_flagged: 8500, transaction_count: 1, approved_by: "mlro@firm.com.au", mlro_sign_off: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, report_id: "RPT-DEMO00004", customer_id: 4, report_type: "smr", status: "submitted", priority: "high", title: "SMR — Li Wei — Velocity Breach", summary: "Suspicious matter: velocity breach over 24h period. 18 transactions totalling AUD $72,400.", austrac_report_type: "SMR", total_amount_flagged: 72400, transaction_count: 18, submitted_to: "AUSTRAC", submission_reference: "REF-7A3B9C2D", submitted_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 5, report_id: "RPT-DEMO00005", customer_id: 5, report_type: "ttr", status: "acknowledged", priority: "medium", title: "TTR — Wei Zhang — AUD $12,000.00", summary: "Cash transaction of AUD $12,000.00 — threshold reporting obligation.", austrac_report_type: "TTR", total_amount_flagged: 12000, transaction_count: 1, submitted_to: "AUSTRAC", submission_reference: "REF-4D2E8F1A", created_at: new Date(Date.now() - 259200000).toISOString() },
];

const DEMO_SUMMARY: Summary = {
  total: 5, by_type: { smr: 2, ttr: 2, ifti_out: 1 },
  by_status: { draft: 1, under_review: 1, approved: 1, submitted: 1, acknowledged: 1 },
  overdue: 0, due_soon: 1, submitted: 2, draft: 1, under_review: 1,
};

type Tab = "reports" | "create" | "obligations";

export default function ReportingDashboard() {
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>(DEMO_REPORTS);
  const [summary, setSummary] = useState<Summary>(DEMO_SUMMARY);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Report | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch(`${API}/api/v1/reports/?limit=100`, { credentials: "include" }),
        fetch(`${API}/api/v1/reports/summary`, { credentials: "include" }),
      ]);
      if (rRes.ok) { const d = await rRes.json(); if (d.length) setReports(d); }
      if (sRes.ok) { const d = await sRes.json(); if (d.total) setSummary(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const advanceStatus = async (reportId: string, action: "review" | "approve" | "submit" | "acknowledge") => {
    const endpoints: Record<string, string> = {
      review: `${API}/api/v1/reports/${reportId}/review?reviewer=compliance%40firm.com.au`,
      approve: `${API}/api/v1/reports/${reportId}/approve?approved_by=mlro%40firm.com.au`,
      submit: `${API}/api/v1/reports/${reportId}/submit`,
      acknowledge: `${API}/api/v1/reports/${reportId}/acknowledge`,
    };
    const statusMap: Record<string, string> = { review: "under_review", approve: "approved", submit: "submitted", acknowledge: "acknowledged" };
    try {
      const opts: RequestInit = action === "submit"
        ? { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submitted_to: "AUSTRAC", approved_by: "mlro@firm.com.au" }) }
        : { method: "POST", credentials: "include" };
      await fetch(endpoints[action], opts);
    } catch {}
    setReports(prev => prev.map(r => r.report_id === reportId ? { ...r, status: statusMap[action] } : r));
    setSelected(prev => prev?.report_id === reportId ? { ...prev, status: statusMap[action] } : prev);
    showToast("success", `Report ${action === "acknowledge" ? "acknowledged" : action + "d"}`);
  };

  const autoGenerate = async () => {
    try { await fetch(`${API}/api/v1/reports/auto-generate/bulk`, { method: "POST", credentials: "include" }); } catch {}
    showToast("success", "Auto-generation triggered — check reports list");
    fetchData();
  };

  const downloadBlob = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = ["report_id,type,status,title,amount_flagged,transaction_count,due_date,submitted_at",
      ...filtered.map(r => `${r.report_id},${r.austrac_report_type || r.report_type},${r.status},"${r.title.replace(/"/g,'""')}",${r.total_amount_flagged},${r.transaction_count},${r.due_date || ""},${r.submitted_at || ""}`)];
    downloadBlob("reports-export.csv", rows.join("\n"), "text/csv");
    showToast("success", `Exported ${filtered.length} report(s) to CSV`);
  };

  const exportReportPdf = (r: Report) => {
    const lines = [
      `AUSTRAC REPORT — ${r.austrac_report_type || r.report_type.toUpperCase()}`,
      `Report ID: ${r.report_id}`,
      `Status: ${r.status}`,
      `Title: ${r.title}`,
      "",
      "Summary:", r.summary,
      r.narrative ? `\nMLRO Narrative:\n${r.narrative}` : "",
      "",
      `Amount flagged: AUD $${r.total_amount_flagged.toLocaleString()}`,
      `Transaction count: ${r.transaction_count}`,
      `Prepared by: ${r.prepared_by || "—"}`,
      `Reviewed by: ${r.reviewed_by || "—"}`,
      `Approved by: ${r.approved_by || "—"}`,
      `MLRO sign-off: ${r.mlro_sign_off ? "Yes" : "Pending"}`,
      r.submission_reference ? `AUSTRAC reference: ${r.submission_reference}` : "",
    ].filter(Boolean).join("\n");
    downloadBlob(`${r.report_id}.txt`, lines, "text/plain");
    showToast("success", `${r.report_id} exported`);
  };

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    return (!search || r.title.toLowerCase().includes(q) || r.report_id.toLowerCase().includes(q))
      && (typeFilter === "all" || r.report_type === typeFilter)
      && (statusFilter === "all" || r.status === statusFilter);
  });

  const TABS = [
    { id: "reports" as Tab,     label: "Reports",        icon: FileText },
    { id: "create" as Tab,      label: "Create Report",  icon: Plus },
    { id: "obligations" as Tab, label: "Obligations",    icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Header */}
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Regulatory Reporting</h1>
            <p className="text-slate-500 text-sm mt-0.5">AUSTRAC — TTR · IFTI · SMR reporting</p>
          </div>
          <div className="flex items-center gap-3">
            {summary.due_soon > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm font-medium">
                <Clock className="w-4 h-4" />{summary.due_soon} due soon
              </div>
            )}
            {summary.overdue > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />{summary.overdue} overdue
              </div>
            )}
            <button onClick={autoGenerate} className="btn-secondary text-sm py-2 px-4">
              <Zap className="w-4 h-4" /> Auto-Generate
            </button>
            <button onClick={exportCsv} className="btn-secondary text-sm py-2 px-4">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={fetchData} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total",       count: summary.total,       color: "text-slate-200" },
            { label: "Draft",       count: summary.draft,       color: "text-slate-400" },
            { label: "In Review",   count: summary.under_review, color: "text-purple-400" },
            { label: "Submitted",   count: summary.submitted,   color: "text-brand-400" },
            { label: "Due Soon",    count: summary.due_soon,    color: "text-amber-400" },
            { label: "Overdue",     count: summary.overdue,     color: "text-red-400" },
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
          {TABS.map(({ id, label, icon: Icon }) => (
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

        {/* ── Reports list ─────────────────────────────────────────────── */}
        {tab === "reports" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="all">Type — All</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                {["all","draft","under_review","approved","submitted","acknowledged","rejected"].map(s => (
                  <option key={s} value={s}>{s === "all" ? "Status — All" : s.replace(/_/g," ")}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-navy-700">
              <table className="w-full text-sm">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Report</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Due</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No reports found</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.report_id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-500 mb-0.5">{r.report_id}</div>
                        <div className="text-slate-200 text-xs font-medium line-clamp-1 max-w-xs">{r.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLOR[r.report_type] || "bg-slate-500/20 text-slate-400")}>
                          {r.austrac_report_type || r.report_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[r.status] || "bg-slate-500/20 text-slate-400")}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {r.total_amount_flagged > 0 ? `AUD $${r.total_amount_flagged.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.due_date ? (
                          <div className={clsx("text-xs font-medium", (r.days_remaining ?? 99) <= 1 ? "text-red-400" : (r.days_remaining ?? 99) <= 3 ? "text-amber-400" : "text-slate-400")}>
                            {r.days_remaining === 0 ? "Due today" : r.days_remaining === 1 ? "1 day left" : r.days_remaining !== undefined ? `${r.days_remaining}d` : "—"}
                          </div>
                        ) : r.submitted_at ? (
                          <span className="text-xs text-teal-400">Submitted</span>
                        ) : <span className="text-slate-600">—</span>}
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
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {reports.length} reports</div>
          </div>
        )}

        {/* ── Create report ─────────────────────────────────────────────── */}
        {tab === "create" && <CreateReportForm onCreated={(r) => { setReports(prev => [r, ...prev]); showToast("success", `${r.report_id} created`); setTab("reports"); }} />}

        {/* ── Obligations ────────────────────────────────────────────────── */}
        {tab === "obligations" && <ObligationsPanel />}
      </div>

      {/* Report detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.report_id}</div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLOR[selected.report_type] || "")}>
                  {selected.austrac_report_type || selected.report_type.toUpperCase()}
                </span>
                {selected.priority && (
                  <span className={clsx("ml-2 text-xs font-medium capitalize", PRIORITY_COLOR[selected.priority])}>
                    {selected.priority} priority
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => exportReportPdf(selected)} title="Export report" className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-brand-400 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Title</div>
              <div className="font-medium text-slate-100 text-sm leading-relaxed">{selected.title}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Summary</div>
              <div className="text-sm text-slate-300 leading-relaxed">{selected.summary}</div>
            </div>

            {selected.narrative && (
              <div>
                <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">MLRO Narrative</div>
                <div className="text-sm text-slate-300 leading-relaxed bg-navy-900 rounded-lg p-3 border border-navy-700">{selected.narrative}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Status", value: <span className={clsx("px-2 py-0.5 rounded-full text-xs capitalize", STATUS_COLOR[selected.status] || "")}>{selected.status.replace(/_/g," ")}</span> },
                { label: "Amount", value: selected.total_amount_flagged > 0 ? `AUD $${selected.total_amount_flagged.toLocaleString()}` : "—" },
                { label: "Txn count", value: selected.transaction_count },
                { label: "Days remaining", value: selected.days_remaining !== undefined ? `${selected.days_remaining}d` : "—" },
                { label: "Prepared by", value: selected.prepared_by || "—" },
                { label: "Reviewed by", value: selected.reviewed_by || "—" },
                { label: "Approved by", value: selected.approved_by || "—" },
                { label: "MLRO sign-off", value: selected.mlro_sign_off ? "✓ Yes" : "Pending" },
                ...(selected.submission_reference ? [{ label: "AUSTRAC ref", value: selected.submission_reference }] : []),
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                  <div className="text-slate-200 text-xs">{value}</div>
                </div>
              ))}
            </div>

            {/* Statutory info box */}
            {STATUTORY_INFO[selected.report_type] && (
              <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-3 text-xs space-y-1">
                <div className="font-medium text-brand-300">Statutory obligation</div>
                <div className="text-slate-400">Deadline: <span className="text-slate-200">{STATUTORY_INFO[selected.report_type].deadline}</span></div>
                <div className="text-slate-400">Authority: <span className="text-slate-200">{STATUTORY_INFO[selected.report_type].obligation}</span></div>
                <div className="text-slate-400">Submit via: <span className="text-slate-200">{STATUTORY_INFO[selected.report_type].form}</span></div>
              </div>
            )}

            {/* Workflow actions */}
            <div className="border-t border-navy-700 pt-4">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Workflow</div>
              <div className="flex gap-2 flex-wrap">
                {selected.status === "draft" && (
                  <button onClick={() => advanceStatus(selected.report_id, "review")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Send for Review
                  </button>
                )}
                {selected.status === "under_review" && (
                  <button onClick={() => advanceStatus(selected.report_id, "approve")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve (MLRO)
                  </button>
                )}
                {selected.status === "approved" && (
                  <button onClick={() => advanceStatus(selected.report_id, "submit")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500/15 border border-brand-500/25 text-brand-300 text-xs font-medium hover:bg-brand-500/25 transition-colors">
                    <Send className="w-3.5 h-3.5" /> Submit to AUSTRAC
                  </button>
                )}
                {selected.status === "submitted" && (
                  <button onClick={() => advanceStatus(selected.report_id, "acknowledge")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-medium hover:bg-teal-500/25 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Acknowledged
                  </button>
                )}
                {selected.status === "acknowledged" && (
                  <div className="flex items-center gap-2 text-teal-400 text-sm">
                    <CheckCircle className="w-4 h-4" /> Reported to AUSTRAC
                  </div>
                )}
              </div>
            </div>

            {selected.customer_id && (
              <div className="border-t border-navy-700 pt-4 space-y-2">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick actions</div>
                <QuickActions actions={[
                  { label: "View Customer", href: `/customers/${selected.customer_id}`, icon: User },
                ]} />
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

// ── Create Report Form ──────────────────────────────────────────────────────────────

function CreateReportForm({ onCreated }: { onCreated: (r: Report) => void }) {
  const [form, setForm] = useState({
    report_type: "smr", customer_id: 1, title: "", summary: "", narrative: "",
    total_amount_flagged: 0, transaction_count: 1, prepared_by: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`${API}/api/v1/reports/`, {
        credentials: "include",
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated(await res.json());
    } catch (err: any) {
      // Demo fallback
      const demoReport: Report = {
        id: Date.now(), report_id: `RPT-${Math.random().toString(36).slice(2,12).toUpperCase()}`,
        customer_id: form.customer_id, report_type: form.report_type, status: "draft",
        priority: "medium", title: form.title, summary: form.summary,
        austrac_report_type: { smr:"SMR", ttr:"TTR", ifti_in:"IFTI-I", ifti_out:"IFTI-E" }[form.report_type] || form.report_type.toUpperCase(),
        total_amount_flagged: form.total_amount_flagged, transaction_count: form.transaction_count,
        prepared_by: form.prepared_by, days_remaining: form.report_type === "smr" ? 4 : 14,
        created_at: new Date().toISOString(),
      };
      onCreated(demoReport);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-6">Create New Report</h2>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Report type *</label>
            <select required className="field-input" value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Customer ID *</label>
            <input type="number" required className="field-input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Title *</label>
          <input required className="field-input" placeholder="e.g. SMR — John Smith — Structuring" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Summary *</label>
          <textarea required className="field-input min-h-[90px] resize-none" placeholder="Factual description of the reportable matter…" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">MLRO narrative</label>
          <textarea className="field-input min-h-[80px] resize-none" placeholder="Compliance officer narrative for AUSTRAC submission…" value={form.narrative} onChange={e => setForm(f => ({ ...f, narrative: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Amount flagged (AUD)</label>
            <input type="number" className="field-input" value={form.total_amount_flagged} onChange={e => setForm(f => ({ ...f, total_amount_flagged: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Transaction count</label>
            <input type="number" className="field-input" value={form.transaction_count} onChange={e => setForm(f => ({ ...f, transaction_count: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Prepared by</label>
            <input className="field-input" placeholder="email or name" value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} />
          </div>
        </div>

        {/* Statutory deadline info */}
        {STATUTORY_INFO[form.report_type] && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
            <div className="font-medium text-amber-300 mb-1">Statutory deadline</div>
            <div className="text-slate-400">This report type must be lodged with AUSTRAC within <strong className="text-amber-300">{STATUTORY_INFO[form.report_type].deadline}</strong> per {STATUTORY_INFO[form.report_type].obligation}.</div>
          </div>
        )}

        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
          {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FileText className="w-4 h-4" />Create Report</>}
        </button>
      </form>
    </div>
  );
}

// ── Obligations Panel ─────────────────────────────────────────────────────────────────

function ObligationsPanel() {
  const obligations = [
    {
      type: "TTR", full: "Threshold Transaction Report", deadline: "10 business days",
      trigger: "Cash transactions ≥ AUD $10,000", law: "AML/CTF Act 2006 s.43",
      who: "All reporting entities", notes: "Includes physically transferred currency. Electronic transfers are excluded.",
      color: "border-blue-500/30 bg-blue-500/5",
    },
    {
      type: "IFTI-E", full: "International Funds Transfer Instruction — Outbound", deadline: "10 business days",
      trigger: "Any international EFT sent on behalf of a customer", law: "AML/CTF Act 2006 s.45",
      who: "ADIs, remittance dealers, DCEs", notes: "No dollar threshold — all cross-border EFTs must be reported.",
      color: "border-purple-500/30 bg-purple-500/5",
    },
    {
      type: "IFTI-I", full: "International Funds Transfer Instruction — Inbound", deadline: "10 business days",
      trigger: "Any international EFT received on behalf of a customer", law: "AML/CTF Act 2006 s.45",
      who: "ADIs, remittance dealers, DCEs", notes: "No dollar threshold — all inbound cross-border EFTs must be reported.",
      color: "border-cyan-500/30 bg-cyan-500/5",
    },
    {
      type: "SMR", full: "Suspicious Matter Report", deadline: "3 business days",
      trigger: "Reasonable grounds to suspect money laundering, tax evasion, terrorism financing, or other serious crime",
      law: "AML/CTF Act 2006 s.41",
      who: "All reporting entities", notes: "Tipping off is a criminal offence. Do not inform the customer. Qualify for safe harbour when SMR lodged in good faith.",
      color: "border-red-500/30 bg-red-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1">AUSTRAC Reporting Obligations</h2>
        <p className="text-slate-500 text-sm">Mandatory reporting requirements under the Anti-Money Laundering and Counter-Terrorism Financing Act 2006.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {obligations.map(ob => (
          <div key={ob.type} className={`rounded-xl border p-5 space-y-3 ${ob.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-slate-100">{ob.type}</div>
                <div className="text-xs text-slate-400 mt-0.5">{ob.full}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-amber-400">{ob.deadline}</div>
                <div className="text-xs text-slate-500">deadline</div>
              </div>
            </div>
            <div className="text-xs space-y-1.5">
              <div><span className="text-slate-500">Trigger: </span><span className="text-slate-300">{ob.trigger}</span></div>
              <div><span className="text-slate-500">Authority: </span><span className="text-slate-300">{ob.law}</span></div>
              <div><span className="text-slate-500">Who: </span><span className="text-slate-300">{ob.who}</span></div>
            </div>
            <div className="text-xs text-slate-400 bg-black/20 rounded-lg p-2 border border-white/5">{ob.notes}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-4">Penalty reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            { offence: "Failure to lodge TTR", penalty: "Up to 2 years imprisonment or 500 penalty units" },
            { offence: "Failure to lodge SMR", penalty: "Up to 2 years imprisonment or 500 penalty units" },
            { offence: "Tipping off", penalty: "Up to 2 years imprisonment or 500 penalty units" },
          ].map(({ offence, penalty }) => (
            <div key={offence} className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <div className="text-red-300 font-medium text-xs mb-1">{offence}</div>
              <div className="text-slate-400 text-xs">{penalty}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-4">Source: AML/CTF Act 2006. This is a compliance tool — always verify with your legal counsel.</p>
      </div>
    </div>
  );
}
