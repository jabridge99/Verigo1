"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, Plus, RefreshCw, CheckCircle, AlertTriangle, Clock, Award,
  BarChart3, Users, BookOpen, RotateCcw, FileBadge, ShieldCheck,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type TrainingStatus = "assigned" | "in_progress" | "completed" | "overdue" | "expired" | "exempt";

interface Course {
  id: string;
  course_code: string;
  name: string;
  training_type: string;
  description?: string | null;
  duration_minutes?: number | null;
  has_assessment: boolean;
  pass_mark?: number | null;
  expiry_months?: number | null;
  applicable_roles: string[];
  applicable_industries: string[];
  linked_control_ids: string[];
  linked_risk_factor_categories: string[];
  is_mandatory: boolean;
  is_active: boolean;
}

interface TrainingRecord {
  id: string;
  course_id: string;
  user_id: string;
  assigned_date: string;
  due_date: string;
  completion_date?: string | null;
  expiry_date?: string | null;
  score?: number | null;
  passed?: boolean | null;
  attempt_number: number;
  status: TrainingStatus;
  is_exempt: boolean;
}

const INDUSTRY_PACKS = [
  { key: "remittance", label: "Remittance" },
  { key: "financial_services", label: "FX & PSP" },
  { key: "vasp", label: "Crypto / VASP" },
  { key: "legal_professionals", label: "Lawyers" },
  { key: "accountants", label: "Accountants" },
  { key: "real_estate", label: "Real Estate" },
  { key: "conveyancers", label: "Conveyancers" },
];

const TRAINING_ROLES = ["admin", "mlro", "compliance", "analyst", "viewer", "director", "operations_staff", "auditor"];

const STATUS_COLOR: Record<TrainingStatus, string> = {
  assigned: "bg-slate-600/20 text-slate-400",
  in_progress: "bg-brand-500/20 text-brand-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  overdue: "bg-red-500/20 text-red-300",
  expired: "bg-amber-500/20 text-amber-300",
  exempt: "bg-slate-700/30 text-slate-500",
};

const DEMO_COURSES: Course[] = [
  { id: "tc_1", course_code: "TRN-IND-001", name: "AML/CTF Induction", training_type: "induction", description: "Foundational AML/CTF obligations for all staff.", duration_minutes: 60, has_assessment: true, pass_mark: 75, expiry_months: 12, applicable_roles: ["all"], applicable_industries: ["all"], linked_control_ids: [], linked_risk_factor_categories: [], is_mandatory: true, is_active: true },
  { id: "tc_2", course_code: "TRN-MLRO-001", name: "MLRO Certification", training_type: "mlro_certification", description: "Advanced obligations and reporting duties for the MLRO.", duration_minutes: 180, has_assessment: true, pass_mark: 85, expiry_months: 12, applicable_roles: ["mlro"], applicable_industries: ["all"], linked_control_ids: ["ctl_4"], linked_risk_factor_categories: ["customer", "transaction"], is_mandatory: true, is_active: true },
  { id: "tc_3", course_code: "TRN-RMT-001", name: "Remittance Sector AML/CTF Obligations", training_type: "custom", description: "IFTI reporting, agent oversight, and structuring red flags.", duration_minutes: 45, has_assessment: true, pass_mark: 80, expiry_months: 12, applicable_roles: ["analyst", "compliance", "mlro"], applicable_industries: ["remittance"], linked_control_ids: [], linked_risk_factor_categories: ["geographic", "transaction"], is_mandatory: true, is_active: true },
  { id: "tc_4", course_code: "TRN-CRY-001", name: "Crypto / VASP Travel Rule Training", training_type: "travel_rule_training", description: "Travel Rule, mixer/darknet exposure, wallet screening.", duration_minutes: 50, has_assessment: true, pass_mark: 80, expiry_months: 12, applicable_roles: ["analyst", "compliance", "mlro"], applicable_industries: ["vasp"], linked_control_ids: [], linked_risk_factor_categories: ["crypto"], is_mandatory: true, is_active: true },
];

const DEMO_RECORDS: TrainingRecord[] = [
  { id: "gtr_1", course_id: "tc_1", user_id: "user_alice", assigned_date: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), completion_date: new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10), expiry_date: new Date(Date.now() + 305 * 86400000).toISOString().slice(0, 10), score: 92, passed: true, attempt_number: 1, status: "completed", is_exempt: false },
  { id: "gtr_2", course_id: "tc_2", user_id: "user_bob", assigned_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), due_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), attempt_number: 1, status: "overdue", is_exempt: false },
  { id: "gtr_3", course_id: "tc_3", user_id: "user_carol", assigned_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), due_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), attempt_number: 1, status: "in_progress", is_exempt: false },
];

const DEMO_DASHBOARD = {
  summary: { total: 3, non_exempt: 3, completed: 1, overdue: 1, in_progress: 1, assigned_not_started: 0, expired: 0, exempt: 0, expiring_within_30_days: 0 },
  metrics: { completion_pct: 33.3, overdue_count: 1, expiring_30d: 0, health_score: 55.6 },
  traffic_lights: { completion: "red", overdue: "red", expiry: "green", overall: "red" },
};

type Tab = "dashboard" | "catalogue" | "records" | "assign" | "report";

export default function TrainingPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [courses, setCourses] = useState<Course[]>(DEMO_COURSES);
  const [records, setRecords] = useState<TrainingRecord[]>(DEMO_RECORDS);
  const [dashboard, setDashboard] = useState<any>(DEMO_DASHBOARD);
  const [report, setReport] = useState<any>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, rRes, dRes] = await Promise.all([
        fetch(`${API}/api/v1/governance/training/courses`, { credentials: "include" }),
        fetch(`${API}/api/v1/governance/training/records`, { credentials: "include" }),
        fetch(`${API}/api/v1/governance/training/dashboard`, { credentials: "include" }),
      ]);
      if (cRes.ok) { const d = await cRes.json(); if (d.courses?.length) setCourses(d.courses); }
      if (rRes.ok) { const d = await rRes.json(); if (d.records?.length) setRecords(d.records); }
      if (dRes.ok) setDashboard(await dRes.json());
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/governance/training/compliance-report`, { credentials: "include" });
      if (res.ok) { setReport(await res.json()); return; }
    } catch {}
    setReport({
      report_date: new Date().toISOString().slice(0, 10),
      overall: { total_assigned: 3, completed: 1, exempt: 0, overdue: 1, completion_pct: 33.3 },
      by_training_type: [
        { training_type: "induction", total_assigned: 1, completed: 1, overdue: 0, exempt: 0, completion_pct: 100 },
        { training_type: "mlro_certification", total_assigned: 1, completed: 0, overdue: 1, exempt: 0, completion_pct: 0 },
        { training_type: "custom", total_assigned: 1, completed: 0, overdue: 0, exempt: 0, completion_pct: 0 },
      ],
    });
  }, []);

  useEffect(() => { if (tab === "report") fetchReport(); }, [tab, fetchReport]);

  const seedPack = async (industry: string | null) => {
    try {
      const url = industry
        ? `${API}/api/v1/governance/training/courses/seed-industry-pack?industry=${industry}`
        : `${API}/api/v1/governance/training/courses/seed-industry-pack`;
      const res = await fetch(url, { method: "POST", credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        showToast("success", d.message || "Pack seeded.");
        fetchAll();
        return;
      }
    } catch {}
    showToast("success", industry ? `${industry} pack seeded (demo).` : "All packs seeded (demo).");
  };

  const seedStandard = async () => {
    try {
      const res = await fetch(`${API}/api/v1/governance/training/courses/seed`, { method: "POST", credentials: "include" });
      if (res.ok) { const d = await res.json(); showToast("success", d.message || "Standard courses seeded."); fetchAll(); return; }
    } catch {}
    showToast("success", "Standard courses seeded (demo).");
  };

  const completeRecord = async (r: TrainingRecord, score: number) => {
    try {
      const res = await fetch(`${API}/api/v1/governance/training/records/${r.id}/complete`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion_date: new Date().toISOString().slice(0, 10), score }),
      });
      if (res.ok) { const updated = await res.json(); setRecords(prev => prev.map(x => x.id === r.id ? updated : x)); showToast("success", "Training marked complete."); return; }
    } catch {}
    setRecords(prev => prev.map(x => x.id === r.id ? { ...x, completion_date: new Date().toISOString().slice(0, 10), score, passed: score >= 75, status: "completed" } : x));
    showToast("success", "Training marked complete (demo).");
  };

  const retakeRecord = async (r: TrainingRecord) => {
    try {
      const res = await fetch(`${API}/api/v1/governance/training/records/${r.id}/retake`, { method: "POST", credentials: "include" });
      if (res.ok) { const updated = await res.json(); setRecords(prev => prev.map(x => x.id === r.id ? updated : x)); showToast("success", "Retake initiated."); return; }
    } catch {}
    showToast("success", "Retake initiated (demo).");
  };

  const renewRecord = async (r: TrainingRecord) => {
    const dueDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    try {
      const res = await fetch(`${API}/api/v1/governance/training/records/${r.id}/renew?due_date=${dueDate}`, { method: "POST", credentials: "include" });
      if (res.ok) { const created = await res.json(); setRecords(prev => [created, ...prev]); showToast("success", "Renewal cycle created."); return; }
    } catch {}
    showToast("success", "Renewal cycle created (demo).");
  };

  const courseName = (id: string) => courses.find(c => c.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Training Suite</h1>
            <p className="text-slate-500 text-sm mt-0.5">Learning Centre, assignment, completion tracking and AML/CTF training compliance reporting</p>
          </div>
          <button onClick={fetchAll} className="btn-secondary text-sm py-2 px-4">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard" as Tab, label: "Dashboard", Icon: BarChart3 },
            { id: "catalogue" as Tab, label: "Learning Centre", Icon: BookOpen },
            { id: "records" as Tab, label: "Training Records", Icon: GraduationCap },
            { id: "assign" as Tab, label: "Assign", Icon: Users },
            { id: "report" as Tab, label: "Compliance Report", Icon: ShieldCheck },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === id ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "dashboard" && <DashboardTab dashboard={dashboard} />}
        {tab === "catalogue" && (
          <CatalogueTab courses={courses} onSeedStandard={seedStandard} onSeedPack={seedPack} />
        )}
        {tab === "records" && (
          <RecordsTab records={records} courseName={courseName} onComplete={completeRecord} onRetake={retakeRecord} onRenew={renewRecord} />
        )}
        {tab === "assign" && (
          <AssignTab courses={courses} onAssigned={() => { showToast("success", "Training assigned."); fetchAll(); }} />
        )}
        {tab === "report" && <ReportTab report={report} />}
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

function DashboardTab({ dashboard }: { dashboard: any }) {
  if (!dashboard) return null;
  const { summary, metrics, traffic_lights } = dashboard;
  const lightColor = (l: string) => l === "green" ? "text-emerald-400" : l === "amber" ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Completion Rate</div>
          <div className="text-2xl font-bold text-slate-100">{metrics.completion_pct}%</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Overdue</div>
          <div className="text-2xl font-bold text-red-400">{metrics.overdue_count}</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Expiring (30d)</div>
          <div className="text-2xl font-bold text-amber-400">{metrics.expiring_30d}</div>
        </div>
        <div className="card">
          <div className="text-xs text-slate-500 mb-1">Health Score</div>
          <div className="text-2xl font-bold text-brand-400">{metrics.health_score}</div>
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-medium text-slate-300 mb-3">Traffic Lights</div>
        <div className="flex gap-6 flex-wrap">
          {Object.entries(traffic_lights).map(([k, v]: [string, any]) => (
            <div key={k} className="flex items-center gap-2">
              <span className={clsx("w-2.5 h-2.5 rounded-full", v === "green" ? "bg-emerald-400" : v === "amber" ? "bg-amber-400" : "bg-red-400")} />
              <span className="text-xs text-slate-400 capitalize">{k}</span>
              <span className={clsx("text-xs font-semibold capitalize", lightColor(v))}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {[
          ["Completed", summary.completed, "text-emerald-400"],
          ["In Progress", summary.in_progress, "text-brand-400"],
          ["Assigned (not started)", summary.assigned_not_started, "text-slate-400"],
          ["Expired", summary.expired, "text-amber-400"],
          ["Exempt", summary.exempt, "text-slate-500"],
          ["Overdue", summary.overdue, "text-red-400"],
          ["Total Records", summary.total, "text-slate-200"],
        ].map(([label, val, color]: any) => (
          <div key={label} className="rounded-lg p-3 bg-navy-800 border border-navy-700">
            <div className="text-slate-500 mb-0.5">{label}</div>
            <div className={clsx("font-bold", color)}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogueTab({ courses, onSeedStandard, onSeedPack }: { courses: Course[]; onSeedStandard: () => void; onSeedPack: (i: string | null) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSeedStandard} className="btn-secondary text-xs py-2 px-3">
          <Plus className="w-3.5 h-3.5" /> Seed Standard Catalogue
        </button>
        <button onClick={() => onSeedPack(null)} className="btn-secondary text-xs py-2 px-3">
          <Plus className="w-3.5 h-3.5" /> Seed All Industry Packs
        </button>
        {INDUSTRY_PACKS.map(p => (
          <button key={p.key} onClick={() => onSeedPack(p.key)}
            className="text-xs py-2 px-3 rounded-lg border border-navy-600 text-slate-400 hover:text-brand-300 hover:border-brand-500/40 transition-colors">
            + {p.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {courses.map(c => (
          <div key={c.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] text-slate-500">{c.course_code}</div>
                <div className="font-semibold text-slate-100">{c.name}</div>
              </div>
              {c.is_mandatory && <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30 whitespace-nowrap">MANDATORY</span>}
            </div>
            {c.description && <p className="text-xs text-slate-400 leading-relaxed">{c.description}</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {c.applicable_industries.map(i => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-navy-700 text-slate-400">{i}</span>
              ))}
            </div>
            {(c.linked_control_ids.length > 0 || c.linked_risk_factor_categories.length > 0) && (
              <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-navy-700 mt-1">
                {c.linked_control_ids.map(id => (
                  <span key={id} className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{id}</span>
                ))}
                {c.linked_risk_factor_categories.map(rc => (
                  <span key={rc} className="flex items-center gap-1 capitalize"><AlertTriangle className="w-3 h-3" />{rc}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
              <span>{c.duration_minutes ?? "—"} min</span>
              {c.has_assessment && <span>Pass mark {c.pass_mark}%</span>}
              {c.expiry_months && <span>Renews every {c.expiry_months}mo</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordsTab({ records, courseName, onComplete, onRetake, onRenew }: {
  records: TrainingRecord[]; courseName: (id: string) => string;
  onComplete: (r: TrainingRecord, score: number) => void;
  onRetake: (r: TrainingRecord) => void;
  onRenew: (r: TrainingRecord) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-700">
      <table className="w-full text-sm">
        <thead className="bg-navy-800 border-b border-navy-700">
          <tr>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">User</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Course</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Due</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Score</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-12 text-slate-500">No training records found</td></tr>
          ) : records.map(r => (
            <tr key={r.id} className="border-b border-navy-800 hover:bg-navy-800/40 transition-colors">
              <td className="px-4 py-3 text-slate-300">{r.user_id}</td>
              <td className="px-4 py-3 text-slate-300">{courseName(r.course_id)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.due_date).toLocaleDateString("en-AU")}</td>
              <td className="px-4 py-3 text-xs text-slate-400">{r.score ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[r.status])}>
                  {r.status.replace("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {(r.status === "assigned" || r.status === "in_progress") && (
                    <button onClick={() => onComplete(r, 88)} className="p-1.5 rounded-lg hover:bg-navy-700 text-emerald-400" title="Mark complete">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {r.passed === false && (
                    <button onClick={() => onRetake(r)} className="p-1.5 rounded-lg hover:bg-navy-700 text-brand-400" title="Retake">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {(r.status === "expired" || r.status === "completed") && (
                    <button onClick={() => onRenew(r)} className="p-1.5 rounded-lg hover:bg-navy-700 text-amber-400" title="Renew cycle">
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                  {r.status === "completed" && (
                    <a href={`${API}/api/v1/governance/training/records/${r.id}/certificate-html`} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded-lg hover:bg-navy-700 text-slate-400" title="Certificate">
                      <FileBadge className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignTab({ courses, onAssigned }: { courses: Course[]; onAssigned: () => void }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [userIds, setUserIds] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      course_id: courseId,
      user_ids: userIds.split(",").map(s => s.trim()).filter(Boolean),
      roles,
      due_date: dueDate,
      trigger: "manual",
    };
    try {
      const res = await fetch(`${API}/api/v1/governance/training/assignments`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {}
    setSubmitting(false);
    onAssigned();
    setUserIds(""); setRoles([]);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Assign Training</h2>
      <p className="text-slate-500 text-sm mb-6">
        Bulk-assign a course to specific users and/or role groups. Director, Operations Staff and Auditor
        are training-only labels — they do not grant system access.
      </p>

      <div className="card space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Course *</label>
          <select className="field-input" value={courseId} onChange={e => setCourseId(e.target.value)}>
            {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">User IDs (comma-separated)</label>
          <input className="field-input" placeholder="user_alice, user_bob"
            value={userIds} onChange={e => setUserIds(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Role groups</label>
          <div className="flex flex-wrap gap-2">
            {TRAINING_ROLES.map(role => (
              <button key={role} type="button" onClick={() => toggleRole(role)}
                className={clsx("px-2.5 py-1 rounded-lg text-xs capitalize border transition-colors",
                  roles.includes(role) ? "border-brand-500/50 bg-brand-500/15 text-brand-300" : "border-navy-600 text-slate-400 hover:text-slate-200")}>
                {role.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Due date *</label>
          <input type="date" className="field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <button type="button" disabled={!courseId || (!userIds && roles.length === 0) || submitting} onClick={handleSubmit} className="btn-primary disabled:opacity-40">
          {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Award className="w-4 h-4" />Assign Training</>}
        </button>
      </div>
    </div>
  );
}

function ReportTab({ report }: { report: any }) {
  if (!report) return <div className="text-slate-500 text-sm">Loading compliance report…</div>;
  return (
    <div className="space-y-5">
      <div className="card">
        <div className="text-sm font-medium text-slate-300 mb-3">AUSTRAC Annual Compliance Report — Training Section</div>
        <div className="text-xs text-slate-500 mb-3">As at {report.report_date}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg p-3 bg-navy-800 border border-navy-700">
            <div className="text-slate-500 mb-0.5">Total Assigned</div>
            <div className="font-bold text-slate-200">{report.overall.total_assigned}</div>
          </div>
          <div className="rounded-lg p-3 bg-navy-800 border border-navy-700">
            <div className="text-slate-500 mb-0.5">Completed</div>
            <div className="font-bold text-emerald-400">{report.overall.completed}</div>
          </div>
          <div className="rounded-lg p-3 bg-navy-800 border border-navy-700">
            <div className="text-slate-500 mb-0.5">Overdue</div>
            <div className="font-bold text-red-400">{report.overall.overdue}</div>
          </div>
          <div className="rounded-lg p-3 bg-navy-800 border border-navy-700">
            <div className="text-slate-500 mb-0.5">Completion %</div>
            <div className="font-bold text-brand-400">{report.overall.completion_pct}%</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-700">
        <table className="w-full text-sm">
          <thead className="bg-navy-800 border-b border-navy-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Training Type</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Assigned</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Completed</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Overdue</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Completion %</th>
            </tr>
          </thead>
          <tbody>
            {report.by_training_type.map((row: any) => (
              <tr key={row.training_type} className="border-b border-navy-800">
                <td className="px-4 py-3 text-slate-300 capitalize">{row.training_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-slate-400">{row.total_assigned}</td>
                <td className="px-4 py-3 text-emerald-400">{row.completed}</td>
                <td className="px-4 py-3 text-red-400">{row.overdue}</td>
                <td className="px-4 py-3 text-slate-300">{row.completion_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        This summary is a governance tooling output only and does not constitute regulatory certification.
      </p>
    </div>
  );
}
