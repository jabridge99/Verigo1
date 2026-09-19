"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase, AlertTriangle, CheckCircle, Clock, Plus,
  Search, RefreshCw, Eye, ChevronRight, User, FileText,
  Shield, BarChart2, Calendar, Send, XCircle, ArrowUpRight,
} from "lucide-react";
import clsx from "clsx";
import QuickActions from "@/components/QuickActions";
import { apiFetch } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Case {
  id: string;
  case_ref: string;
  customer_id: string;
  industry_id?: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  assigned_to?: string;
  alert_ids?: string[];
  notes?: string;
  created_at?: string;
  closed_at?: string;
  outcome?: string;
  outcome_notes?: string;
  closure_reason?: string;
}

const CLOSE_STATUSES = [
  "closed_no_action", "closed_smr_filed", "closed_referred", "closed_exited", "closed_no_smr",
];
const CASE_OUTCOMES = [
  "no_suspicious_activity", "smr_filed", "referred_law_enforcement", "customer_exited",
  "controls_enhanced", "edd_completed", "no_action_required", "other",
];

const SEV_COLOR: Record<string, string> = {
  low:      "bg-slate-500/20 text-slate-300 border-slate-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const SEV_DOT: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-amber-400", high: "bg-orange-400", critical: "bg-red-500",
};

const STATUS_COLOR: Record<string, string> = {
  open:                  "bg-red-500/20 text-red-300",
  under_investigation:   "bg-blue-500/20 text-blue-300",
  additional_information:"bg-sky-500/20 text-sky-300",
  escalated:              "bg-purple-500/20 text-purple-300",
  decision:               "bg-amber-500/20 text-amber-300",
  closed_no_action:       "bg-teal-500/20 text-teal-300",
  closed_smr_filed:       "bg-emerald-500/20 text-emerald-300",
  closed_referred:        "bg-orange-500/20 text-orange-300",
  closed_exited:          "bg-slate-500/20 text-slate-300",
  closed_no_smr:          "bg-teal-500/20 text-teal-300",
};

const OBLIGATIONS = [
  { label: "TTR filing due", date: new Date(Date.now() + 86400000 * 2), type: "ttr", urgent: true },
  { label: "SMR — Ivan Petrov", date: new Date(Date.now() + 86400000 * 1), type: "smr", urgent: true },
  { label: "Quarterly AML review", date: new Date(Date.now() + 86400000 * 14), type: "review", urgent: false },
  { label: "ECDD refresh — Li Wei", date: new Date(Date.now() + 86400000 * 7), type: "ecdd", urgent: false },
  { label: "Annual CDD update batch", date: new Date(Date.now() + 86400000 * 21), type: "review", urgent: false },
];

type Tab = "cases" | "create" | "calendar" | "overview";

interface LinkedAlert {
  id: string;
  alert_ref: string;
  category: string;
  severity: string;
  status: string;
}

export default function MLRODashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [cases, setCases] = useState<Case[]>([]);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Case | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [closeForm, setCloseForm] = useState<{
    status: string; outcome: string; closure_reason: string; outcome_notes: string;
  } | null>(null);
  const [linkedAlerts, setLinkedAlerts] = useState<LinkedAlert[]>([]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchCases = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/api/v1/cases?limit=100`, { credentials: "include" });
      if (res.ok) { setCases(await res.json()); } else { showToast("error", "Failed to load cases"); }
    } catch {
      showToast("error", "Failed to load cases");
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);
  useEffect(() => { setCloseForm(null); }, [selected?.id]);

  useEffect(() => {
    if (!selected) { setLinkedAlerts([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${API}/api/v1/cases/${selected.id}/alerts`, { credentials: "include" });
        if (!cancelled) setLinkedAlerts(res.ok ? await res.json() : []);
      } catch {
        if (!cancelled) setLinkedAlerts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.id]);

  const updateStatus = async (caseId: string, status: string) => {
    try {
      const res = await apiFetch(`${API}/api/v1/cases/${caseId}/status`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: status }),
      });
      if (!res.ok) { showToast("error", "Failed to update case status"); return; }
      const updated = await res.json();
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...updated } : c));
      setSelected(prev => prev?.id === caseId ? { ...prev, ...updated } : prev);
      showToast("success", `Case moved to ${status.replace(/_/g, " ")}`);
    } catch {
      showToast("error", "Failed to update case status");
    }
  };

  const submitClose = async () => {
    if (!selected || !closeForm) return;
    if (!closeForm.closure_reason.trim()) { showToast("error", "Closure reason is required"); return; }
    try {
      const res = await apiFetch(`${API}/api/v1/cases/${selected.id}/close`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: closeForm.status,
          outcome: closeForm.outcome,
          outcome_notes: closeForm.outcome_notes || undefined,
          closure_reason: closeForm.closure_reason,
        }),
      });
      if (!res.ok) { showToast("error", "Failed to close case"); return; }
      const updated = await res.json();
      const caseId = selected.id;
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...updated } : c));
      setSelected(prev => prev?.id === caseId ? { ...prev, ...updated } : prev);
      setCloseForm(null);
      showToast("success", `Case closed — ${closeForm.status.replace(/_/g, " ")}`);
    } catch {
      showToast("error", "Failed to close case");
    }
  };

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    return (!search || c.title.toLowerCase().includes(q) || c.case_ref.toLowerCase().includes(q))
      && (sevFilter === "all" || c.severity === sevFilter)
      && (statusFilter === "all" || c.status === statusFilter);
  });

  const isClosed = (status: string) => (CLOSE_STATUSES as string[]).includes(status);

  const stats = {
    open: cases.filter(c => c.status === "open").length,
    investigating: cases.filter(c => c.status === "under_investigation").length,
    escalated: cases.filter(c => c.status === "escalated").length,
    critical: cases.filter(c => c.severity === "critical").length,
    closed_this_week: cases.filter(c => isClosed(c.status) && c.closed_at && Date.now() - new Date(c.closed_at).getTime() < 604800000).length,
  };

  const TABS = [
    { id: "overview" as Tab, label: "Overview",   icon: BarChart2 },
    { id: "cases" as Tab,    label: "Case Queue", icon: Briefcase },
    { id: "create" as Tab,   label: "New Case",   icon: Plus },
    { id: "calendar" as Tab, label: "Calendar",   icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">MLRO Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Money Laundering Reporting Officer — case management & compliance oversight</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.escalated > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-sm font-medium">
                <ArrowUpRight className="w-4 h-4" />{stats.escalated} escalated
              </div>
            )}
            {stats.critical > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />{stats.critical} critical
              </div>
            )}
            <button onClick={fetchCases} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total cases",   count: cases.length,          color: "text-slate-200" },
            { label: "Open",          count: stats.open,            color: "text-red-400" },
            { label: "Investigating", count: stats.investigating,   color: "text-blue-400" },
            { label: "Escalated",     count: stats.escalated,       color: "text-purple-400" },
            { label: "Critical",      count: stats.critical,        color: "text-red-400" },
            { label: "Closed (7d)",   count: stats.closed_this_week,color: "text-teal-400" },
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

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Open cases",         value: stats.open,            sub: "requiring action",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
                { label: "Under investigation", value: stats.investigating,  sub: "being worked",      color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "Escalated to MLRO",  value: stats.escalated,       sub: "need sign-off",     color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
                { label: "Closed this week",   value: stats.closed_this_week,sub: "resolved",          color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/20" },
              ].map(({ label, value, sub, color, bg }) => (
                <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                  <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  <div className="text-sm text-slate-200 font-medium mt-1">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            {cases.filter(c => c.severity === "critical" && !isClosed(c.status)).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Critical cases requiring immediate attention
                </h2>
                <div className="space-y-2">
                  {cases.filter(c => c.severity === "critical" && !isClosed(c.status)).map(c => (
                    <div key={c.case_ref} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-red-500/10 transition-colors"
                      onClick={() => { setSelected(c); setTab("cases"); }}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-slate-500">{c.case_ref}</span>
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLOR[c.status] || "")}>{c.status.replace(/_/g, " ")}</span>
                        </div>
                        <div className="font-semibold text-slate-100 text-sm">{c.title}</div>
                        <div className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-400" /> Upcoming compliance obligations
              </h2>
              <div className="rounded-xl border border-navy-700 overflow-hidden">
                {OBLIGATIONS.map((ob, i) => {
                  const daysOut = Math.ceil((ob.date.getTime() - Date.now()) / 86400000);
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-navy-800 last:border-0 ${ob.urgent ? "bg-red-500/5" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${ob.urgent ? "bg-red-500" : "bg-slate-600"}`} />
                        <span className={`text-sm ${ob.urgent ? "text-slate-200" : "text-slate-400"}`}>{ob.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-navy-700 text-slate-500 uppercase">{ob.type}</span>
                      </div>
                      <span className={`text-xs font-medium ${daysOut <= 2 ? "text-red-400" : daysOut <= 7 ? "text-amber-400" : "text-slate-500"}`}>
                        {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `${daysOut}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-400" /> Case severity breakdown
              </h2>
              <div className="rounded-xl border border-navy-700 bg-navy-800 p-4 space-y-3">
                {["critical","high","medium","low"].map(sev => {
                  const count = cases.filter(c => c.severity === sev).length;
                  const pct = cases.length ? (count / cases.length) * 100 : 0;
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-16 capitalize">{sev}</span>
                      <div className="flex-1 h-2 rounded-full bg-navy-700">
                        <div className={`h-full rounded-full ${SEV_DOT[sev]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-4 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "cases" && (
          <div className="flex gap-6">
            <div className={clsx("flex-1 space-y-4 min-w-0", selected && "hidden lg:block")}>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                    placeholder="Search cases…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                  className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                  {["all","critical","high","medium","low"].map(v => (
                    <option key={v} value={v}>{v === "all" ? "Severity — All" : v.charAt(0).toUpperCase()+v.slice(1)}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                  {["all","open","under_investigation","escalated","decision",...CLOSE_STATUSES].map(v => (
                    <option key={v} value={v}>{v === "all" ? "Status — All" : v.replace(/_/g," ")}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {filtered.length === 0 && <div className="text-center py-16 text-slate-500">No cases found</div>}
                {filtered.map(c => (
                  <div key={c.case_ref}
                    className={clsx(
                      "rounded-xl border p-4 cursor-pointer transition-all hover:border-brand-500/40",
                      selected?.case_ref === c.case_ref ? "border-brand-500/50 bg-brand-500/5" : "border-navy-700 bg-navy-800/30 hover:bg-navy-800/60"
                    )}
                    onClick={() => setSelected(c)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${SEV_DOT[c.severity]}`} />
                          <span className="font-mono text-xs text-slate-500">{c.case_ref}</span>
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLOR[c.status] || "")}>{c.status.replace(/_/g," ")}</span>
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", SEV_COLOR[c.severity] || "")}>{c.severity}</span>
                        </div>
                        <div className="font-semibold text-slate-100 text-sm">{c.title}</div>
                        {c.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</div>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {c.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.assigned_to}</span>}
                          {c.alert_ids?.length ? <span>{c.alert_ids.length} alert{c.alert_ids.length > 1 ? "s" : ""}</span> : null}
                          {c.created_at && <span>{new Date(c.created_at).toLocaleDateString("en-AU")}</span>}
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-slate-600 hover:text-brand-400 transition-colors shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 text-right">{filtered.length} of {cases.length} cases</div>
            </div>

            {selected && (
              <div className="w-full lg:w-96 shrink-0 space-y-4">
                <div className="flex items-center justify-between lg:hidden">
                  <span className="text-sm font-medium text-slate-300">Case detail</span>
                  <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-navy-700 text-slate-400 text-lg">&times;</button>
                </div>

                <div className="rounded-xl border border-navy-700 bg-navy-800 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs text-slate-500 mb-1">{selected.case_ref}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", SEV_COLOR[selected.severity] || "")}>{selected.severity}</span>
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[selected.status] || "")}>{selected.status.replace(/_/g," ")}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 lg:hidden">&times;</button>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-100 text-sm leading-snug">{selected.title}</div>
                    {selected.description && <div className="text-xs text-slate-400 mt-2 leading-relaxed">{selected.description}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: "Assigned to",  value: selected.assigned_to || "Unassigned" },
                      { label: "Customer ID",  value: `CUST-${selected.customer_id}` },
                      { label: "Linked alerts",value: linkedAlerts.length ? `${linkedAlerts.length} alert${linkedAlerts.length > 1 ? "s" : ""}` : "None" },
                      { label: "Opened",       value: selected.created_at ? new Date(selected.created_at).toLocaleDateString("en-AU") : "—" },
                      ...(selected.closed_at ? [{ label: "Closed", value: new Date(selected.closed_at).toLocaleDateString("en-AU") }] : []),
                      ...(selected.outcome ? [{ label: "Outcome", value: selected.outcome.replace(/_/g, " ") }] : []),
                      ...(selected.closure_reason ? [{ label: "Closure reason", value: selected.closure_reason }] : []),
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-slate-500 mb-0.5">{label}</div>
                        <div className="text-slate-200 truncate">{value}</div>
                      </div>
                    ))}
                  </div>

                  {linkedAlerts.length > 0 && (
                    <div className="border-t border-navy-700 pt-4 space-y-2">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Linked alerts</div>
                      <div className="space-y-1.5">
                        {linkedAlerts.map(a => (
                          <Link key={a.id} href={`/monitoring?customer=${selected.customer_id ?? ""}`}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-navy-700 bg-navy-900/40 hover:border-brand-500/40 transition-colors text-xs">
                            <span className="font-mono text-slate-400">{a.alert_ref}</span>
                            <span className="text-slate-300 capitalize">{a.category.replace(/_/g, " ")}</span>
                            <span className={clsx("px-2 py-0.5 rounded-full font-medium border capitalize", SEV_COLOR[a.severity] || "")}>{a.severity}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-navy-700 pt-4">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Actions</div>
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "open" && (
                        <button onClick={() => updateStatus(selected.id, "under_investigation")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium hover:bg-blue-500/25 transition-colors">
                          <Search className="w-3.5 h-3.5" /> Start Investigating
                        </button>
                      )}
                      {selected.status === "under_investigation" && (
                        <>
                          <button onClick={() => updateStatus(selected.id, "escalated")}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Escalate to MLRO
                          </button>
                          <button onClick={() => updateStatus(selected.id, "decision")}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                            <Clock className="w-3.5 h-3.5" /> Pending Review
                          </button>
                        </>
                      )}
                      {selected.status === "escalated" && (
                        <button onClick={() => updateStatus(selected.id, "decision")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                          <FileText className="w-3.5 h-3.5" /> MLRO Sign-off
                        </button>
                      )}
                      {selected.status === "decision" && !closeForm && (
                        <button onClick={() => setCloseForm({ status: "closed_no_action", outcome: "no_suspicious_activity", closure_reason: "", outcome_notes: "" })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-medium hover:bg-teal-500/25 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Close Case
                        </button>
                      )}
                      {selected.status.startsWith("closed") && (
                        <div className="flex items-center gap-2 text-teal-400 text-sm">
                          <CheckCircle className="w-4 h-4" /> Case closed
                        </div>
                      )}
                    </div>
                  </div>

                  {selected.status === "decision" && closeForm && (
                    <div className="border-t border-navy-700 pt-4 space-y-3">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Close case</div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Closing status *</label>
                        <select className="field-input" value={closeForm.status}
                          onChange={e => setCloseForm(f => f && { ...f, status: e.target.value })}>
                          {CLOSE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Outcome *</label>
                        <select className="field-input" value={closeForm.outcome}
                          onChange={e => setCloseForm(f => f && { ...f, outcome: e.target.value })}>
                          {CASE_OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Closure reason *</label>
                        <textarea className="field-input min-h-[70px] resize-none"
                          placeholder="Why is this case being closed…"
                          value={closeForm.closure_reason}
                          onChange={e => setCloseForm(f => f && { ...f, closure_reason: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Outcome notes</label>
                        <textarea className="field-input min-h-[60px] resize-none"
                          placeholder="Optional additional detail…"
                          value={closeForm.outcome_notes}
                          onChange={e => setCloseForm(f => f && { ...f, outcome_notes: e.target.value })} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={submitClose}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-medium hover:bg-teal-500/25 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm close
                        </button>
                        <button onClick={() => setCloseForm(null)}
                          className="px-3 py-2 rounded-lg border border-navy-600 text-slate-400 text-xs font-medium hover:bg-navy-700 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-navy-700 pt-4 space-y-2">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick actions</div>
                    <QuickActions actions={[
                      { label: "View alerts", href: selected.alert_ids?.length ? `/monitoring?customer=${selected.customer_id}` : "/monitoring", icon: AlertTriangle },
                      { label: "File report", href: `/reporting?customer=${selected.customer_id}&action=new&case=${selected.case_ref}`, icon: FileText },
                      { label: "Customer profile", href: `/customers/${selected.customer_id}`, icon: User },
                    ]} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "create" && (
          <CreateCaseForm
            onCreated={(c) => {
              setCases(prev => [c, ...prev]);
              showToast("success", `${c.case_ref} created`);
              setTab("cases");
              setSelected(c);
            }}
            onError={(msg) => showToast("error", msg)}
          />
        )}

        {tab === "calendar" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">Compliance Calendar</h2>
              <p className="text-slate-500 text-sm">Upcoming statutory deadlines and scheduled reviews.</p>
            </div>
            <div className="space-y-3">
              {OBLIGATIONS.map((ob, i) => {
                const daysOut = Math.ceil((ob.date.getTime() - Date.now()) / 86400000);
                return (
                  <div key={i} className={`rounded-xl border p-4 flex items-center justify-between ${ob.urgent ? "border-red-500/30 bg-red-500/5" : "border-navy-700 bg-navy-800/30"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${ob.urgent ? "bg-red-500/20 text-red-300" : "bg-navy-700 text-slate-400"}`}>
                        {daysOut}d
                      </div>
                      <div>
                        <div className={`font-medium text-sm ${ob.urgent ? "text-slate-100" : "text-slate-300"}`}>{ob.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{ob.date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-navy-700 text-slate-400 uppercase">{ob.type}</span>
                      {ob.urgent && <span className="text-xs font-medium text-red-400">Action required</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Open cases by age</h3>
              <div className="overflow-x-auto rounded-xl border border-navy-700">
                <table className="w-full text-sm">
                  <thead className="bg-navy-800 border-b border-navy-700">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Case</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Severity</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Age</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.filter(c => !isClosed(c.status)).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()).map(c => {
                      const ageDays = c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000) : 0;
                      return (
                        <tr key={c.case_ref} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer" onClick={() => { setSelected(c); setTab("cases"); }}>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-slate-500">{c.case_ref}</div>
                            <div className="text-slate-200 text-xs font-medium mt-0.5 line-clamp-1">{c.title}</div>
                          </td>
                          <td className="px-4 py-3"><span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", SEV_COLOR[c.severity] || "")}>{c.severity}</span></td>
                          <td className="px-4 py-3"><span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[c.status] || "")}>{c.status.replace(/_/g," ")}</span></td>
                          <td className="px-4 py-3"><span className={`text-xs font-medium ${ageDays > 7 ? "text-red-400" : ageDays > 3 ? "text-amber-400" : "text-slate-400"}`}>{ageDays === 0 ? "Today" : `${ageDays}d`}</span></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{c.assigned_to || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
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

function CreateCaseForm({
  onCreated, onError,
}: {
  onCreated: (c: Case) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    customer_id: "", title: "", description: "",
    severity: "medium", assigned_to: "", created_by: "mlro@firm.com.au",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API}/api/v1/cases`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { onError("Failed to create case"); return; }
      onCreated(await res.json());
    } catch {
      onError("Failed to create case");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-6">Open New Case</h2>
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Customer ID *</label>
            <input type="text" required placeholder="e.g. cust_a1b2c3d4e5f6" className="field-input" value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Severity *</label>
            <select required className="field-input" value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
              {["low","medium","high","critical"].map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Case title *</label>
          <input required className="field-input" placeholder="e.g. Structuring pattern — John Smith"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Description</label>
          <textarea className="field-input min-h-[100px] resize-none"
            placeholder="Describe the suspicious activity, trigger alerts, and initial assessment…"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Assign to</label>
            <input className="field-input" placeholder="analyst@firm.com.au"
              value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Created by</label>
            <input className="field-input" placeholder="mlro@firm.com.au"
              value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))} />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
          {submitting
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Briefcase className="w-4 h-4" />Open Case</>}
        </button>
      </form>
    </div>
  );
}
