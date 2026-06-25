"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, AlertTriangle, Clock, CheckCircle, Send,
  RefreshCw, Search, Eye, Download, User, Info,
} from "lucide-react";
import clsx from "clsx";
import QuickActions from "@/components/QuickActions";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ReportKind = "ifti" | "ttr" | "smr";

interface Report {
  id: string;
  report_ref: string;
  report_type: ReportKind;
  direction?: string; // ifti only: incoming | outgoing
  customer_id?: string;
  case_id?: string;
  status: string;
  priority?: string;
  title: string;
  summary: string;
  narrative?: string;
  total_amount_flagged: number;
  transaction_count: number;
  austrac_report_type: string;
  due_date?: string;
  prepared_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  mlro_sign_off?: string;
  submission_reference?: string;
  created_at?: string;
  submitted_at?: string;
  acknowledged_at?: string;
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

const AUSTRAC_LABEL: Record<string, string> = {
  ifti_incoming: "IFTI-I", ifti_outgoing: "IFTI-E", ttr: "TTR", smr: "SMR",
};

const TYPE_LABELS: Record<string, string> = {
  ttr: "TTR — Threshold Transaction",
  ifti: "IFTI — International Funds Transfer",
  smr: "SMR — Suspicious Matter",
};

const TYPE_COLOR: Record<string, string> = {
  ttr: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ifti: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  smr: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_COLOR: Record<string, string> = {
  draft:        "bg-slate-500/20 text-slate-300",
  under_review: "bg-purple-500/20 text-purple-300",
  approved:     "bg-emerald-500/20 text-emerald-300",
  submitted:    "bg-brand-500/20 text-brand-300",
  acknowledged: "bg-teal-500/20 text-teal-300",
  rejected:     "bg-red-500/20 text-red-300",
};

const STATUTORY_INFO: Record<string, { deadline: string; obligation: string; form: string }> = {
  ttr:  { deadline: "10 business days", obligation: "AML/CTF Act 2006 s.43", form: "AUSTRAC Online — TTR" },
  ifti: { deadline: "10 business days", obligation: "AML/CTF Act 2006 s.45", form: "AUSTRAC Online — IFTI" },
  smr:  { deadline: "3 business days",  obligation: "AML/CTF Act 2006 s.41", form: "AUSTRAC Online — SMR" },
};

function mapReport(raw: any, type: ReportKind): Report {
  if (type === "smr") {
    return {
      id: raw.id,
      report_ref: raw.report_ref,
      report_type: "smr",
      customer_id: raw.customer_id,
      case_id: raw.case_id,
      status: raw.status,
      priority: raw.priority,
      title: `SMR — ${raw.subject_name || raw.customer_id || "Unknown subject"}`,
      summary: raw.suspicion_grounds || "Suspicious matter report.",
      narrative: raw.narrative,
      total_amount_flagged: raw.total_amount ?? raw.grand_total ?? 0,
      transaction_count: Array.isArray(raw.transaction_ids) ? raw.transaction_ids.length : 0,
      austrac_report_type: "SMR",
      due_date: raw.due_date,
      prepared_by: raw.prepared_by,
      reviewed_by: raw.reviewed_by,
      approved_by: raw.approved_by,
      mlro_sign_off: raw.mlro_sign_off,
      submission_reference: raw.submission_reference,
      created_at: raw.created_at,
      submitted_at: raw.submitted_at,
      acknowledged_at: raw.acknowledged_at,
    };
  }
  if (type === "ifti") {
    const austracType = raw.direction === "incoming" ? "ifti_incoming" : "ifti_outgoing";
    return {
      id: raw.id,
      report_ref: raw.report_ref,
      report_type: "ifti",
      direction: raw.direction,
      customer_id: raw.customer_id,
      status: raw.status,
      priority: raw.priority,
      title: `${AUSTRAC_LABEL[austracType]} — Customer ${raw.customer_id ?? "—"}`,
      summary: `${raw.direction === "incoming" ? "Inbound" : "Outbound"} international funds transfer of ${raw.currency || "AUD"} $${(raw.total_amount ?? 0).toLocaleString()}.`,
      total_amount_flagged: raw.amount_aud ?? raw.total_amount ?? 0,
      transaction_count: 1,
      austrac_report_type: AUSTRAC_LABEL[austracType],
      due_date: raw.due_date,
      prepared_by: raw.prepared_by,
      reviewed_by: raw.reviewed_by,
      approved_by: raw.approved_by,
      submission_reference: raw.submission_reference,
      created_at: raw.created_at,
      submitted_at: raw.submitted_at,
      acknowledged_at: raw.acknowledged_at,
    };
  }
  // ttr
  return {
    id: raw.id,
    report_ref: raw.report_ref,
    report_type: "ttr",
    customer_id: raw.customer_id,
    status: raw.status,
    priority: raw.priority,
    title: `TTR — Customer ${raw.customer_id ?? "—"} — ${raw.currency || "AUD"} $${(raw.total_amount ?? 0).toLocaleString()}`,
    summary: `Cash transaction of ${raw.currency || "AUD"} $${(raw.total_amount ?? 0).toLocaleString()} meets the threshold reporting obligation under the AML/CTF Act 2006 s.43.`,
    total_amount_flagged: raw.total_amount ?? 0,
    transaction_count: 1,
    austrac_report_type: "TTR",
    due_date: raw.due_date,
    prepared_by: raw.prepared_by,
    reviewed_by: raw.reviewed_by,
    approved_by: raw.approved_by,
    submission_reference: raw.submission_reference,
    created_at: raw.created_at,
    submitted_at: raw.submitted_at,
    acknowledged_at: raw.acknowledged_at,
  };
}

function daysRemaining(dueDate?: string): number | undefined {
  if (!dueDate) return undefined;
  const ms = new Date(dueDate).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

const DEMO_REPORTS: Report[] = [
  mapReport({ id: "smr_demo001", report_ref: "SMR-DEMO00001", customer_id: "cust_demo01", status: "draft", priority: "urgent", suspicion_grounds: "Sanctions watchlist match on Ivan Petrov.", subject_name: "Ivan Petrov", total_amount: 15000, transaction_ids: ["txn_1"], due_date: new Date(Date.now() + 86400000).toISOString(), created_at: new Date(Date.now() - 3600000).toISOString() }, "smr"),
  mapReport({ id: "ttr_demo001", report_ref: "TTR-DEMO00002", customer_id: "cust_demo02", status: "under_review", priority: "high", total_amount: 45000, currency: "AUD", due_date: new Date(Date.now() + 432000000).toISOString(), reviewed_by: "compliance@firm.com.au", created_at: new Date(Date.now() - 7200000).toISOString() }, "ttr"),
  mapReport({ id: "ifti_demo001", report_ref: "IFTI-DEMO00003", customer_id: "cust_demo03", direction: "outgoing", status: "approved", priority: "medium", total_amount: 8500, amount_aud: 8500, currency: "AUD", due_date: new Date(Date.now() + 604800000).toISOString(), approved_by: "mlro@firm.com.au", created_at: new Date(Date.now() - 86400000).toISOString() }, "ifti"),
  mapReport({ id: "smr_demo002", report_ref: "SMR-DEMO00004", customer_id: "cust_demo04", status: "submitted", priority: "high", suspicion_grounds: "Velocity breach over 24h period.", subject_name: "Li Wei", total_amount: 72400, transaction_ids: Array.from({ length: 18 }, (_, i) => `txn_${i}`), submission_reference: "REF-7A3B9C2D", submitted_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 172800000).toISOString() }, "smr"),
  mapReport({ id: "ttr_demo002", report_ref: "TTR-DEMO00005", customer_id: "cust_demo05", status: "acknowledged", priority: "medium", total_amount: 12000, currency: "AUD", submission_reference: "REF-4D2E8F1A", created_at: new Date(Date.now() - 259200000).toISOString() }, "ttr"),
];

const DEMO_SUMMARY: Summary = {
  total: 5, by_type: { smr: 2, ttr: 2, ifti: 1 },
  by_status: { draft: 1, under_review: 1, approved: 1, submitted: 1, acknowledged: 1 },
  overdue: 0, due_soon: 1, submitted: 2, draft: 1, under_review: 1,
};

type Tab = "reports" | "obligations";

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
      const [iRes, tRes, sRes, sumRes] = await Promise.all([
        fetch(`${API}/api/v1/reports/ifti?limit=100`, { credentials: "include" }),
        fetch(`${API}/api/v1/reports/ttr?limit=100`, { credentials: "include" }),
        fetch(`${API}/api/v1/reports/smr?limit=100`, { credentials: "include" }),
        fetch(`${API}/api/v1/reports/summary`, { credentials: "include" }),
      ]);
      const all: Report[] = [];
      if (iRes.ok) (await iRes.json()).forEach((r: any) => all.push(mapReport(r, "ifti")));
      if (tRes.ok) (await tRes.json()).forEach((r: any) => all.push(mapReport(r, "ttr")));
      if (sRes.ok) (await sRes.json()).forEach((r: any) => all.push(mapReport(r, "smr")));
      if (all.length) setReports(all);
      if (sumRes.ok) { const d = await sumRes.json(); if (d.total !== undefined) setSummary(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const advanceStatus = async (report: Report, action: "review" | "approve" | "submit" | "acknowledge") => {
    const base = `${API}/api/v1/reports/${report.report_type}/${report.id}`;
    const statusMap: Record<string, string> = { review: "under_review", approve: "approved", submit: "submitted", acknowledge: "acknowledged" };
    let url = "";
    if (action === "review") url = `${base}/review`;
    else if (action === "approve") url = report.report_type === "smr" ? `${base}/mlro-sign-off` : `${base}/approve`;
    else if (action === "submit") url = `${base}/submit?submission_reference=${encodeURIComponent(`AUTO-${Date.now()}`)}`;
    else url = `${base}/acknowledge?acknowledgement_ref=${encodeURIComponent(`ACK-${Date.now()}`)}`;
    try {
      const res = await fetch(url, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
    } catch (err: any) {
      showToast("error", `Failed to ${action}: ${err.message || "request failed"}`);
      return;
    }
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: statusMap[action] } : r));
    setSelected(prev => prev?.id === report.id ? { ...prev, status: statusMap[action] } : prev);
    showToast("success", `Report ${action === "acknowledge" ? "acknowledged" : action + "d"}`);
  };

  const downloadBlob = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = ["report_ref,type,status,title,amount_flagged,due_date,submitted_at",
      ...filtered.map(r => `${r.report_ref},${r.austrac_report_type},${r.status},"${r.title.replace(/"/g,'""')}",${r.total_amount_flagged},${r.due_date || ""},${r.submitted_at || ""}`)];
    downloadBlob("reports-export.csv", rows.join("\n"), "text/csv");
    showToast("success", `Exported ${filtered.length} report(s) to CSV`);
  };

  const exportReportPdf = (r: Report) => {
    const lines = [
      `AUSTRAC REPORT — ${r.austrac_report_type}`,
      `Report ref: ${r.report_ref}`,
      `Status: ${r.status}`,
      `Title: ${r.title}`,
      "",
      "Summary:", r.summary,
      r.narrative ? `\nMLRO Narrative:\n${r.narrative}` : "",
      "",
      `Amount flagged: AUD $${r.total_amount_flagged.toLocaleString()}`,
      `Prepared by: ${r.prepared_by || "—"}`,
      `Reviewed by: ${r.reviewed_by || "—"}`,
      `Approved by: ${r.approved_by || "—"}`,
      `MLRO sign-off: ${r.mlro_sign_off || "Pending"}`,
      r.submission_reference ? `AUSTRAC reference: ${r.submission_reference}` : "",
    ].filter(Boolean).join("\n");
    downloadBlob(`${r.report_ref}.txt`, lines, "text/plain");
    showToast("success", `${r.report_ref} exported`);
  };

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    return (!search || r.title.toLowerCase().includes(q) || r.report_ref.toLowerCase().includes(q))
      && (typeFilter === "all" || r.report_type === typeFilter)
      && (statusFilter === "all" || r.status === statusFilter);
  });

  const TABS = [
    { id: "reports" as Tab,     label: "Reports",     icon: FileText },
    { id: "obligations" as Tab, label: "Obligations", icon: AlertTriangle },
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
            <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-slate-400">
              <Info className="w-4 h-4 text-brand-300 shrink-0 mt-0.5" />
              <span>New reports aren't created freeform here — IFTI/TTR reports are generated from a qualifying transaction in <strong className="text-slate-200">Transaction Monitoring</strong>, and SMRs are generated from a case flagged for SMR consideration in the <strong className="text-slate-200">MLRO Dashboard</strong>.</span>
            </div>
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
                  ) : filtered.map(r => {
                    const dr = daysRemaining(r.due_date);
                    return (
                    <tr key={r.id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-500 mb-0.5">{r.report_ref}</div>
                        <div className="text-slate-200 text-xs font-medium line-clamp-1 max-w-xs">{r.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLOR[r.report_type] || "bg-slate-500/20 text-slate-400")}>
                          {r.austrac_report_type}
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
                          <div className={clsx("text-xs font-medium", (dr ?? 99) <= 1 ? "text-red-400" : (dr ?? 99) <= 3 ? "text-amber-400" : "text-slate-400")}>
                            {dr === 0 ? "Due today" : dr === 1 ? "1 day left" : dr !== undefined ? `${dr}d` : "—"}
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
                  );})}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {reports.length} reports</div>
          </div>
        )}

        {/* ── Obligations ────────────────────────────────────────────────── */}
        {tab === "obligations" && <ObligationsPanel />}
      </div>

      {/* Report detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.report_ref}</div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", TYPE_COLOR[selected.report_type] || "")}>
                  {selected.austrac_report_type}
                </span>
                {selected.priority && (
                  <span className="ml-2 text-xs font-medium capitalize text-slate-400">
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
                { label: "Days remaining", value: (() => { const dr = daysRemaining(selected.due_date); return dr !== undefined ? `${dr}d` : "—"; })() },
                { label: "Prepared by", value: selected.prepared_by || "—" },
                { label: "Reviewed by", value: selected.reviewed_by || "—" },
                { label: "Approved by", value: selected.approved_by || "—" },
                { label: "MLRO sign-off", value: selected.mlro_sign_off ? `✓ ${selected.mlro_sign_off}` : "Pending" },
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
                  <button onClick={() => advanceStatus(selected, "review")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Send for Review
                  </button>
                )}
                {selected.status === "under_review" && (
                  <button onClick={() => advanceStatus(selected, "approve")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> {selected.report_type === "smr" ? "MLRO Sign-Off" : "Approve (MLRO)"}
                  </button>
                )}
                {selected.status === "approved" && (
                  <button onClick={() => advanceStatus(selected, "submit")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500/15 border border-brand-500/25 text-brand-300 text-xs font-medium hover:bg-brand-500/25 transition-colors">
                    <Send className="w-3.5 h-3.5" /> Submit to AUSTRAC
                  </button>
                )}
                {selected.status === "submitted" && (
                  <button onClick={() => advanceStatus(selected, "acknowledge")}
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
