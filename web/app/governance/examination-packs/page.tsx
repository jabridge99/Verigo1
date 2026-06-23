"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderArchive, RefreshCw, Plus, CheckCircle, AlertTriangle, Download,
  Send, Archive,
} from "lucide-react";
import clsx from "clsx";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PackStatus = "generating" | "ready" | "delivered" | "archived";

interface Pack {
  id: string;
  pack_ref: string;
  status: PackStatus;
  period_start: string;
  period_end: string;
  sections: string[];
  examiner_name?: string | null;
  examiner_agency: string;
  examination_ref?: string | null;
  summary_metrics?: Record<string, any> | null;
  generation_errors?: string[] | null;
  version: number;
}

const STATUS_COLOR: Record<PackStatus, string> = {
  generating: "bg-amber-500/20 text-amber-300",
  ready: "bg-emerald-500/20 text-emerald-300",
  delivered: "bg-purple-500/20 text-purple-300",
  archived: "bg-slate-600/20 text-slate-500",
};

const ALL_SECTIONS = [
  "aml_program", "customer_profile", "transaction_monitoring", "smr_register",
  "ifti_register", "ttr_register", "training_records", "independent_reviews",
  "policy_register", "control_testing", "notification_history",
];

const SECTION_LABELS: Record<string, string> = {
  aml_program: "AML/CTF Program", customer_profile: "Customer Profile", transaction_monitoring: "Transaction Monitoring",
  smr_register: "SMR Register", ifti_register: "IFTI Register", ttr_register: "TTR Register",
  training_records: "Training Records", independent_reviews: "Independent Reviews",
  policy_register: "Policy Register", control_testing: "Control Testing", notification_history: "Notification History",
};

const DEMO_PACKS: Pack[] = [
  { id: "ep_1", pack_ref: "EXAM-2026-001", status: "ready", period_start: "2025-01-01", period_end: "2025-12-31", sections: ALL_SECTIONS, examiner_agency: "AUSTRAC", version: 1, summary_metrics: { sections_generated: 11 } },
];

export default function ExaminationPacksPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const [packs, setPacks] = useState<Pack[]>(DEMO_PACKS);
  const [demo, setDemo] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ period_start: "", period_end: "", examiner_name: "", examination_ref: "" });
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchPacks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/examination-packs/`, { credentials: "include" });
      if (!res.ok) throw new Error("api");
      const d = await res.json();
      if (Array.isArray(d) && d.length) setPacks(d);
    } catch { setDemo(true); }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } fetchPacks(); }, []);

  const toggleSection = (s: string) => {
    setSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const generatePack = async () => {
    if (!form.period_start || !form.period_end) {
      showToast("error", "Period start and end are required");
      return;
    }
    try {
      const res = await fetch(`${API}/api/v1/examination-packs/`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: form.period_start, period_end: form.period_end,
          sections: sections.length === ALL_SECTIONS.length ? null : sections,
          examiner_name: form.examiner_name || null, examination_ref: form.examination_ref || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPacks(prev => [created, ...prev]);
        setShowCreate(false);
        showToast("success", `${created.pack_ref} generated`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Failed to generate pack");
      }
    } catch { showToast("error", "Network error"); }
  };

  const deliver = async (p: Pack) => {
    const notes = prompt("Delivery notes (optional):") || undefined;
    try {
      const res = await fetch(`${API}/api/v1/examination-packs/${p.id}/deliver`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_notes: notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPacks(prev => prev.map(x => x.id === p.id ? updated : x));
        showToast("success", `${p.pack_ref} marked delivered`);
      } else showToast("error", "Failed (MLRO role required, pack must be ready)");
    } catch { showToast("error", "Network error"); }
  };

  const archive = async (p: Pack) => {
    try {
      const res = await fetch(`${API}/api/v1/examination-packs/${p.id}/archive`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setPacks(prev => prev.map(x => x.id === p.id ? { ...x, status: "archived" as PackStatus } : x));
        showToast("success", `${p.pack_ref} archived`);
      } else showToast("error", "Failed to archive");
    } catch { showToast("error", "Network error"); }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400"><FolderArchive className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">AUSTRAC Examination Packs</h1>
              <p className="text-slate-500 text-sm mt-0.5">One-click regulator-ready evidence bundle for s.167 examinations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchPacks} className="btn-secondary text-sm py-2 px-4"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowCreate(v => !v)} className="btn-primary text-sm py-2 px-4"><Plus className="w-4 h-4" /> Generate Pack</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample examination pack data
          </div>
        )}

        {showCreate && (
          <div className="card mb-6 space-y-3">
            <h3 className="font-semibold text-sm">Generate Examination Pack</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" placeholder="Period start" />
              <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" placeholder="Period end" />
              <input placeholder="Examiner name (optional)" value={form.examiner_name}
                onChange={e => setForm(f => ({ ...f, examiner_name: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="AUSTRAC examination ref (optional)" value={form.examination_ref}
                onChange={e => setForm(f => ({ ...f, examination_ref: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-2">Sections to include</div>
              <div className="flex flex-wrap gap-2">
                {ALL_SECTIONS.map(s => (
                  <button key={s} onClick={() => toggleSection(s)}
                    className={clsx("text-xs px-2.5 py-1 rounded-full border transition-colors",
                      sections.includes(s) ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-navy-700 text-slate-500")}>
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={generatePack} className="btn-primary text-sm py-2 px-4">Generate</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {packs.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-slate-500">{p.pack_ref} · {p.examiner_agency} {p.examination_ref ? `· Ref: ${p.examination_ref}` : ""}</div>
                  <div className="font-medium text-slate-100 mt-0.5">{p.period_start} → {p.period_end}</div>
                  <div className="text-xs text-slate-500 mt-1">{p.sections.length} sections{p.examiner_name ? ` · ${p.examiner_name}` : ""}</div>
                </div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap", STATUS_COLOR[p.status])}>
                  {p.status}
                </span>
              </div>

              {p.generation_errors && p.generation_errors.length > 0 && (
                <div className="mt-2 text-xs text-amber-400">{p.generation_errors.length} section(s) had generation errors</div>
              )}

              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {p.status === "ready" && (
                  <>
                    <a href={`${API}/api/v1/examination-packs/${p.id}/export-html`} target="_blank" rel="noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3"><Download className="w-3.5 h-3.5" /> Export HTML (print to PDF)</a>
                    <a href={`${API}/api/v1/examination-packs/${p.id}/export-csv`} className="btn-secondary text-xs py-1.5 px-3">
                      <Download className="w-3.5 h-3.5" /> Export CSV Index
                    </a>
                    <button onClick={() => deliver(p)} className="btn-primary text-xs py-1.5 px-3">
                      <Send className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  </>
                )}
                {p.status === "delivered" && (
                  <button onClick={() => archive(p)} className="btn-secondary text-xs py-1.5 px-3">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                )}
                {p.status === "generating" && (
                  <span className="text-xs text-amber-400">Generating — refresh shortly</span>
                )}
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
