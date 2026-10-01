"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileBarChart, RefreshCw, Plus, CheckCircle, AlertTriangle, Download,
  Send, Archive, ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  BoardReport as Report,
  ReportStatus,
  ReportType,
  ReportPeriod,
  listBoardReports,
  createBoardReport,
  submitReportForReview,
  approveBoardReport,
  distributeBoardReport,
  archiveBoardReport,
} from "@/lib/api/boardReports";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TYPE_LABELS: Record<ReportType, string> = {
  board_aml: "Board AML/CTF Report",
  quarterly_compliance: "Quarterly Compliance Report",
  risk_committee: "Risk Committee Report",
  annual_aml: "Annual AML/CTF Program Report",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  draft: "bg-slate-500/20 text-slate-300",
  under_review: "bg-brand-500/20 text-brand-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  distributed: "bg-purple-500/20 text-purple-300",
  archived: "bg-slate-600/20 text-slate-500",
};

const DEMO_REPORTS: Report[] = [
  { id: "br_1", report_ref: "BR-2026-Q2", org_id: "demo", report_type: "board_aml", status: "under_review", period: "q2", period_start: "2026-04-01", period_end: "2026-06-30", report_year: 2026, title: "Board AML/CTF Report — Q2 2026", is_confidential: true, version: 1 },
  { id: "br_2", report_ref: "BR-2026-Q1", org_id: "demo", report_type: "board_aml", status: "distributed", period: "q1", period_start: "2026-01-01", period_end: "2026-03-31", report_year: 2026, title: "Board AML/CTF Report — Q1 2026", approved_by: "mlro_1", distributed_to: ["Board", "Audit Committee"], is_confidential: true, version: 1 },
];

export default function BoardReportsPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const [reports, setReports] = useState<Report[]>(DEMO_REPORTS);
  const [demo, setDemo] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ report_ref: string; report_type: ReportType; period: ReportPeriod; period_start: string; period_end: string }>(
    { report_ref: "", report_type: "board_aml", period: "q2", period_start: "", period_end: "" }
  );
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchReports = useCallback(async () => {
    try {
      const d = await listBoardReports();
      setReports(d.items);
      setDemo(false);
    } catch { setReports(DEMO_REPORTS); setDemo(true); }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } fetchReports(); }, []);

  const createReport = async () => {
    if (!form.report_ref || !form.period_start || !form.period_end) {
      showToast("error", "Report ref, period start and end are required");
      return;
    }
    try {
      const created = await createBoardReport(form);
      setReports(prev => [created, ...prev]);
      setShowCreate(false);
      showToast("success", `${created.report_ref} created with live data snapshot`);
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : "Failed to create report"); }
  };

  const applyTransition = async (r: Report, action: string, update: () => Promise<Report>) => {
    try {
      const updated = await update();
      setReports(prev => prev.map(x => x.id === r.id ? updated : x));
      showToast("success", `${r.report_ref}: ${action.replace(/-/g, " ")}`);
    } catch (e: unknown) { showToast("error", e instanceof Error ? e.message : `Failed: ${action}`); }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><FileBarChart className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Board & Executive Reporting</h1>
              <p className="text-slate-500 text-sm mt-0.5">Auto-populated board reports — draft, approve, distribute</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchReports} className="btn-secondary text-sm py-2 px-4"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowCreate(v => !v)} className="btn-primary text-sm py-2 px-4"><Plus className="w-4 h-4" /> New Report</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample report data
          </div>
        )}

        {showCreate && (
          <div className="card mb-6 space-y-3">
            <h3 className="font-semibold text-sm">New Board Report</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Report ref (e.g. BR-2026-Q3)" value={form.report_ref}
                onChange={e => setForm(f => ({ ...f, report_ref: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
              <select value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value as ReportType }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value as ReportPeriod }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm">
                {["q1", "q2", "q3", "q4", "h1", "h2", "annual", "custom"].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
              <div />
              <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <p className="text-xs text-slate-500">Snapshot is auto-populated from live Cases, SMR, Customers, Alerts, Training, Policies, Controls and Independent Review data at creation time.</p>
            <div className="flex gap-2">
              <button onClick={createReport} className="btn-primary text-sm py-2 px-4">Generate Report</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-slate-500">{r.report_ref} · {TYPE_LABELS[r.report_type]} · v{r.version}</div>
                  <div className="font-medium text-slate-100 mt-0.5">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{r.period_start} → {r.period_end}</div>
                </div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap", STATUS_COLOR[r.status])}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {r.status === "draft" && (
                  <button onClick={() => applyTransition(r, "submit-for-review", () => submitReportForReview(r.id))} className="btn-secondary text-xs py-1.5 px-3">
                    <Send className="w-3.5 h-3.5" /> Submit for Review
                  </button>
                )}
                {r.status === "under_review" && (
                  <button onClick={() => applyTransition(r, "approve", () => approveBoardReport(r.id))} className="btn-primary text-xs py-1.5 px-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approve (MLRO)
                  </button>
                )}
                {r.status === "approved" && (
                  <button onClick={() => applyTransition(r, "distribute", () => distributeBoardReport(r.id, { distributed_to: ["Board", "Audit Committee"] }))} className="btn-primary text-xs py-1.5 px-3">
                    <Send className="w-3.5 h-3.5" /> Distribute to Board
                  </button>
                )}
                {r.status === "distributed" && (
                  <button onClick={() => applyTransition(r, "archive", () => archiveBoardReport(r.id))} className="btn-secondary text-xs py-1.5 px-3">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                )}
                <a href={`${API}/api/v1/board-reports/${r.id}/export-html`} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3"><Download className="w-3.5 h-3.5" /> Export HTML (print to PDF)</a>
                <a href={`${API}/api/v1/board-reports/${r.id}/export-csv`} className="btn-secondary text-xs py-1.5 px-3">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

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
