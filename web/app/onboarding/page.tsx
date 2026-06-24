"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Upload, UserPlus, BarChart3, RefreshCw, X, CheckCircle, AlertCircle, FolderUp, ScanSearch } from "lucide-react";
import BulkUpload from "@/components/Onboarding/BulkUpload";
import ApplicantTable from "@/components/Onboarding/ApplicantTable";
import PipelineView from "@/components/Onboarding/PipelineView";
import DocumentUploadStep from "@/components/Onboarding/DocumentUploadStep";
import ScreeningStep from "@/components/Onboarding/ScreeningStep";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INDUSTRY_ID = "digital-currency-exchange";

interface Session {
  id: number;
  session_id: string;
  applicant_name: string;
  applicant_email: string;
  customer_type: string;
  status: string;
  current_step: number;
  total_steps: number;
  completion_pct: number;
  documents_uploaded: number;
  reminders_sent: number;
  sanctions_match?: boolean;
  risk_level?: string;
  risk_score?: number;
  created_at?: string;
  customer_id?: string;
}

interface PipelineStats {
  total: number; invited: number; opened: number; in_progress: number;
  completed: number; rejected: number; expired: number;
  avg_completion_pct: number; sanctions_matches: number;
}

// Step 1 "Applicant" has its own sub-tabs (list / bulk import / manual entry),
// nested one layer below the top-level step tabs.
type Tab = "pipeline" | "applicants" | "import" | "manual" | "documents" | "screening";
type ApplicantSubTab = "applicants" | "import" | "manual";

const TAB_ALIASES: Record<string, Tab> = {
  pipeline: "pipeline",
  applicants: "applicants",
  import: "import",
  "bulk-import": "import",
  bulk: "import",
  manual: "manual",
  "manual-entry": "manual",
  add: "manual",
  documents: "documents",
  "document-upload": "documents",
  screening: "screening",
};

const APPLICANT_TABS: Tab[] = ["applicants", "import", "manual"];

function tabFromParam(value: string | null): Tab {
  if (!value) return "pipeline";
  return TAB_ALIASES[value] ?? "pipeline";
}

export default function OnboardingDashboard() {
  return (
    <Suspense fallback={null}>
      <OnboardingDashboardInner />
    </Suspense>
  );
}

function OnboardingDashboardInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [manualForm, setManualForm] = useState({ applicant_name: "", applicant_email: "", applicant_phone: "", applicant_company: "", customer_type: "individual" });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, statsRes] = await Promise.all([
        fetch(`${API}/api/v1/onboarding/sessions?industry_id=${INDUSTRY_ID}&limit=200`, { credentials: "include" }),
        fetch(`${API}/api/v1/onboarding/stats?industry_id=${INDUSTRY_ID}`, { credentials: "include" }),
      ]);
      if (sessRes.ok) setSessions(await sessRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Demo data when API not available
  useEffect(() => {
    if (!loading && sessions.length === 0) {
      setSessions([
        { id: 1, session_id: "OBS-DEMO001", applicant_name: "Jane Smith", applicant_email: "jane@example.com", customer_type: "individual", status: "completed", current_step: 5, total_steps: 5, completion_pct: 100, documents_uploaded: 2, reminders_sent: 0, risk_level: "low", risk_score: 22, created_at: new Date().toISOString() },
        { id: 2, session_id: "OBS-DEMO002", applicant_name: "Acme Pty Ltd", applicant_email: "accounts@acme.com.au", customer_type: "business", status: "in_progress", current_step: 3, total_steps: 5, completion_pct: 60, documents_uploaded: 1, reminders_sent: 1, risk_level: "medium", created_at: new Date().toISOString() },
        { id: 3, session_id: "OBS-DEMO003", applicant_name: "Ivan Petrov", applicant_email: "ivan@test.com", customer_type: "individual", status: "rejected", current_step: 5, total_steps: 5, completion_pct: 100, documents_uploaded: 2, reminders_sent: 0, sanctions_match: true, risk_level: "critical", risk_score: 95, created_at: new Date().toISOString() },
        { id: 4, session_id: "OBS-DEMO004", applicant_name: "Li Wei", applicant_email: "li.wei@example.com", customer_type: "individual", status: "invited", current_step: 0, total_steps: 5, completion_pct: 0, documents_uploaded: 0, reminders_sent: 0, created_at: new Date().toISOString() },
      ]);
      setStats({ total: 4, invited: 1, opened: 0, in_progress: 1, completed: 1, rejected: 1, expired: 0, avg_completion_pct: 65, sanctions_matches: 1 });
    }
  }, [loading, sessions.length]);

  const handleRemind = async (sessionId: string) => {
    try {
      const res = await fetch(`${API}/api/v1/onboarding/sessions/${sessionId}/remind`, { method: "POST", credentials: "include" });
      if (res.ok) { showToast("success", "Reminder sent"); fetchData(); }
      else throw new Error();
    } catch { showToast("error", "Failed to send reminder"); }
  };

  const handleCancel = async (sessionId: string) => {
    try {
      const res = await fetch(`${API}/api/v1/onboarding/sessions/${sessionId}/cancel`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      showToast("success", "Verification request cancelled");
      setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, status: "cancelled" } : s));
      setSelectedSession(null);
      fetchData();
    } catch {
      showToast("error", "Failed to cancel verification request");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    try {
      const res = await fetch(`${API}/api/v1/onboarding/sessions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manualForm, industry_id: INDUSTRY_ID }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("success", `Invite sent to ${manualForm.applicant_email}`);
      setManualForm({ applicant_name: "", applicant_email: "", applicant_phone: "", applicant_company: "", customer_type: "individual" });
      setTab("applicants");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to create session");
    } finally { setSubmittingManual(false); }
  };

  // The 3-step KYC pipeline: applicant self-entry, operator-assisted document
  // upload, then document screening with the composite identity score.
  const TABS = [
    { id: "pipeline" as Tab,    label: "Pipeline",            icon: BarChart3 },
    { id: "applicants" as Tab,  label: "Step 1 · Applicant",  icon: Users },
    { id: "documents" as Tab,   label: "Step 2 · Document Upload", icon: FolderUp },
    { id: "screening" as Tab,   label: "Step 3 · Screening",  icon: ScanSearch },
  ];

  const APPLICANT_SUBTABS: { id: ApplicantSubTab; label: string; icon: typeof Users }[] = [
    { id: "applicants", label: "Applicants",   icon: Users },
    { id: "import",     label: "Bulk Import",  icon: Upload },
    { id: "manual",     label: "Manual Entry", icon: UserPlus },
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Customer Onboarding</h1>
            <p className="text-slate-500 text-sm mt-0.5">Autopilot — manage your entire applicant pipeline</p>
          </div>
          <button onClick={fetchData} className="btn-secondary text-sm py-2 px-4 self-start sm:self-auto">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === "applicants" ? APPLICANT_TABS.includes(tab) : tab === id;
            return (
              <button key={id} onClick={() => setTab(id === "applicants" && APPLICANT_TABS.includes(tab) ? tab : id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  active ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === "pipeline" && stats && <><h2 className="text-lg font-semibold text-slate-100 mb-6">Pipeline Overview</h2><PipelineView stats={stats} /></>}

        {APPLICANT_TABS.includes(tab) && (
          <div className="space-y-6">
            <div className="flex gap-1 border-b border-navy-800">
              {APPLICANT_SUBTABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === id ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            {tab === "applicants" && <><h2 className="text-lg font-semibold text-slate-100 mb-6">All Applicants</h2><ApplicantTable sessions={sessions} onRemind={handleRemind} onSelect={setSelectedSession} /></>}

            {tab === "import" && (
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-slate-100 mb-2">Bulk Import</h2>
                <p className="text-slate-500 text-sm mb-6">Upload a CSV or Excel file to create multiple onboarding sessions at once.</p>
                <BulkUpload industryId={INDUSTRY_ID} onComplete={(batchId) => { showToast("success", `Batch ${batchId} imported`); setTab("applicants"); fetchData(); }} />
              </div>
            )}

            {tab === "manual" && (
              <div className="max-w-xl">
                <h2 className="text-lg font-semibold text-slate-100 mb-2">Manual Entry</h2>
                <p className="text-slate-500 text-sm mb-6">Add a single applicant and send them an onboarding invite.</p>
                <form onSubmit={handleManualSubmit} className="card space-y-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-slate-400">Full name *</label>
                    <input required className="field-input" placeholder="Jane Smith" value={manualForm.applicant_name} onChange={e => setManualForm(f => ({ ...f, applicant_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Email address *</label>
                    <input required type="email" className="field-input" placeholder="jane@example.com" value={manualForm.applicant_email} onChange={e => setManualForm(f => ({ ...f, applicant_email: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Phone</label>
                      <input className="field-input" placeholder="+61 400 000 000" value={manualForm.applicant_phone} onChange={e => setManualForm(f => ({ ...f, applicant_phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400">Customer type</label>
                      <select className="field-input" value={manualForm.customer_type} onChange={e => setManualForm(f => ({ ...f, customer_type: e.target.value }))}>
                        <option value="individual">Individual</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Company name</label>
                    <input className="field-input" placeholder="Optional" value={manualForm.applicant_company} onChange={e => setManualForm(f => ({ ...f, applicant_company: e.target.value }))} />
                  </div>
                  <button type="submit" disabled={submittingManual} className="btn-primary w-full justify-center">
                    {submittingManual ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" />Send Invite</>}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <>
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Step 2 · Document Upload</h2>
            <p className="text-slate-500 text-sm mb-6">Operator-assisted — open an applicant's profile and drag and drop their identity documents.</p>
            <DocumentUploadStep sessions={sessions} onUploaded={() => fetchData()} />
          </>
        )}

        {tab === "screening" && (
          <>
            <h2 className="text-lg font-semibold text-slate-100 mb-2">Step 3 · Document Screening</h2>
            <p className="text-slate-500 text-sm mb-6">OCR, manual review, PEP, sanctions, adverse media and company checks combined into a single weighted identity score — Australia's 100-point ID check, digitised.</p>
            <ScreeningStep sessions={sessions} />
          </>
        )}
      </div>

      {selectedSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSession(null)}>
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div><h3 className="font-bold text-slate-100">{selectedSession.applicant_name}</h3><p className="text-sm text-slate-500">{selectedSession.applicant_email}</p></div>
              <button onClick={() => setSelectedSession(null)} className="p-1.5 rounded-lg hover:bg-navy-700 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "Session ID", value: selectedSession.session_id },
                { label: "Status", value: selectedSession.status.replace(/_/g, " ") },
                { label: "Progress", value: `${selectedSession.completion_pct}%` },
                { label: "Documents submitted", value: `${selectedSession.documents_uploaded}` },
                { label: "Reminders sent", value: `${selectedSession.reminders_sent}` },
                { label: "Risk", value: selectedSession.risk_level || "—" },
                { label: "Sanctions", value: selectedSession.sanctions_match ? "⚠ Match found" : "Clear" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-navy-700 pb-2 last:border-0">
                  <span className="text-slate-500">{label}</span>
                  <span className={`text-slate-200 capitalize ${label === "Sanctions" && selectedSession.sanctions_match ? "text-red-400 font-medium" : ""}`}>{value}</span>
                </div>
              ))}
            </div>

            {!["completed", "rejected", "cancelled"].includes(selectedSession.status) && (
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-navy-700">
                <button onClick={() => handleRemind(selectedSession.session_id)} className="btn-secondary text-xs py-1.5 px-3">
                  Resend Link
                </button>
                <button onClick={() => handleCancel(selectedSession.session_id)} className="text-xs py-1.5 px-3 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors">
                  Cancel Request
                </button>
              </div>
            )}
            {selectedSession.documents_uploaded > 0 && (
              <div className="mt-3">
                <a href={`/documents?session=${selectedSession.session_id}`} className="text-xs text-brand-400 hover:underline">
                  View submitted documents →
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
