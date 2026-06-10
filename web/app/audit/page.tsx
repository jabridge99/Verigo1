"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, RefreshCw, Download, Eye,
  CheckCircle, AlertTriangle, FileText, Shield, User,
  Activity,
} from "lucide-react";
import clsx from "clsx";

interface AuditLog {
  id: number;
  log_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor?: string;
  actor_role?: string;
  industry_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  notes?: string;
  ip_address?: string;
  created_at?: string;
}

const ENTITY_COLOR: Record<string, string> = {
  report:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  alert:      "bg-red-500/20 text-red-300 border-red-500/30",
  case:       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  customer:   "bg-teal-500/20 text-teal-300 border-teal-500/30",
  ecdd:       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  kyc:        "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  transaction:"bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  report:     FileText,
  alert:      AlertTriangle,
  case:       ClipboardList,
  customer:   User,
  ecdd:       Shield,
  kyc:        CheckCircle,
  transaction:Activity,
};

const ROLE_COLOR: Record<string, string> = {
  mlro:      "text-purple-400",
  analyst:   "text-blue-400",
  system:    "text-slate-500",
  api:       "text-slate-400",
  compliance:"text-teal-400",
};

const DEMO_LOGS: AuditLog[] = [
  { id: 1,  log_id: "LOG-DEMO000001", action: "report.submitted",       entity_type: "report",     entity_id: "RPT-DEMO00004", actor: "mlro@firm.com.au",       actor_role: "mlro",      before_state: { status: "approved" },      after_state: { status: "submitted", submitted_to: "AUSTRAC", reference: "REF-7A3B9C2D" }, notes: "SMR submitted to AUSTRAC within 3-day statutory deadline", created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 2,  log_id: "LOG-DEMO000002", action: "alert.escalated",        entity_type: "alert",      entity_id: "ALT-DEMO00001", actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: { status: "open" },          after_state: { status: "escalated", escalated_to: "mlro@firm.com.au" },                        notes: "Sanctions match requires MLRO sign-off",                 created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 3,  log_id: "LOG-DEMO000003", action: "customer.risk_updated",  entity_type: "customer",   entity_id: "CUST-DEMO0003", actor: "system",                 actor_role: "system",    before_state: { risk_level: "high", risk_score: 72 }, after_state: { risk_level: "critical", risk_score: 95 }, notes: "Risk score updated after ECDD completion", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 4,  log_id: "LOG-DEMO000004", action: "case.status_changed",    entity_type: "case",       entity_id: "CASE-DEMO00001",actor: "mlro@firm.com.au",       actor_role: "mlro",      before_state: { status: "investigating" }, after_state: { status: "escalated" },              notes: "Critical sanctions case escalated to MLRO",              created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 5,  log_id: "LOG-DEMO000005", action: "ecdd.completed",         entity_type: "ecdd",       entity_id: "ECDD-DEMO00001",actor: "compliance@firm.com.au", actor_role: "compliance",before_state: { status: "pending" },        after_state: { status: "completed", recommendation: "reject" },   notes: "ECDD assessment finalised — reject recommendation",      created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 6,  log_id: "LOG-DEMO000006", action: "report.status_changed",  entity_type: "report",     entity_id: "RPT-DEMO00002", actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: { status: "draft" },         after_state: { status: "under_review" },                           notes: "TTR sent for MLRO review",                               created_at: new Date(Date.now() - 18000000).toISOString() },
  { id: 7,  log_id: "LOG-DEMO000007", action: "alert.resolved",         entity_type: "alert",      entity_id: "ALT-DEMO00005", actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: { status: "open" },          after_state: { status: "resolved", resolution: "false_positive" }, notes: "Velocity alert — confirmed legitimate payroll run",       created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 8,  log_id: "LOG-DEMO000008", action: "customer.status_changed",entity_type: "customer",   entity_id: "CUST-DEMO0003", actor: "system",                 actor_role: "system",    before_state: { status: "active" },        after_state: { status: "suspended" },                              notes: "Account suspended — sanctions screening hit",            created_at: new Date(Date.now() - 90000000).toISOString() },
  { id: 9,  log_id: "LOG-DEMO000009", action: "report.approved",        entity_type: "report",     entity_id: "RPT-DEMO00003", actor: "mlro@firm.com.au",       actor_role: "mlro",      before_state: { status: "under_review" },  after_state: { status: "approved", mlro_sign_off: true },          notes: "IFTI-E approved — MLRO sign-off complete",               created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 10, log_id: "LOG-DEMO000010", action: "kyc.approved",           entity_type: "kyc",        entity_id: "KYC-DEMO00001", actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: { status: "under_review" },  after_state: { status: "approved", identity_score: 92 },           notes: "Identity verification passed — passport verified",       created_at: new Date(Date.now() - 259200000).toISOString() },
  { id: 11, log_id: "LOG-DEMO000011", action: "case.opened",            entity_type: "case",       entity_id: "CASE-DEMO00002",actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: null,                        after_state: { status: "open", severity: "high" },                 notes: "New case opened — PEP structuring pattern",             created_at: new Date(Date.now() - 345600000).toISOString() },
  { id: 12, log_id: "LOG-DEMO000012", action: "alert.dismissed",        entity_type: "alert",      entity_id: "ALT-DEMO00003", actor: "analyst@firm.com.au",    actor_role: "analyst",   before_state: { status: "open" },          after_state: { status: "dismissed" },                              notes: "Low-risk transaction — within normal pattern for customer",created_at: new Date(Date.now() - 432000000).toISOString() },
];

const ENTITY_TYPES = ["all","report","alert","case","customer","ecdd","kyc","transaction"];
const ACTOR_ROLES  = ["all","mlro","analyst","system","compliance","api"];

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>(DEMO_LOGS);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audit/?limit=200");
      if (res.ok) { const d = await res.json(); if (d.length) setLogs(d); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const exportCSV = async () => {
    try {
      const res = await fetch("/api/v1/audit/export/csv");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "audit_log.csv"; a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    const rows = [
      ["log_id","action","entity_type","entity_id","actor","actor_role","notes","created_at"],
      ...logs.map(l => [l.log_id, l.action, l.entity_type, l.entity_id, l.actor||"", l.actor_role||"", l.notes||"", l.created_at||""]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return (!search || l.action.toLowerCase().includes(q) || l.entity_id.toLowerCase().includes(q) || (l.actor||"").toLowerCase().includes(q) || (l.notes||"").toLowerCase().includes(q))
      && (entityFilter === "all" || l.entity_type === entityFilter)
      && (roleFilter === "all" || l.actor_role === roleFilter);
  });

  const stats = {
    total: logs.length,
    today: logs.filter(l => l.created_at && Date.now() - new Date(l.created_at).getTime() < 86400000).length,
    byType: ENTITY_TYPES.slice(1).reduce((acc, t) => ({ ...acc, [t]: logs.filter(l => l.entity_type === t).length }), {} as Record<string, number>),
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000)    return "just now";
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Audit Trail</h1>
            <p className="text-slate-500 text-sm mt-0.5">Immutable compliance log — every system action timestamped and recorded</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportCSV} className="btn-secondary text-sm py-2 px-4">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={fetchLogs} disabled={loading} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-slate-500 text-xs">Total entries</span>
            <span className="font-bold text-sm text-slate-200">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-slate-500 text-xs">Today</span>
            <span className="font-bold text-sm text-brand-400">{stats.today}</span>
          </div>
          {Object.entries(stats.byType).filter(([, v]) => v > 0).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs capitalize">{type}</span>
              <span className="font-bold text-sm text-slate-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        <div className={clsx("flex-1 space-y-4 min-w-0", selected && "hidden lg:block")}>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                placeholder="Search actions, IDs, actors, notes…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              {ENTITY_TYPES.map(v => (
                <option key={v} value={v}>{v === "all" ? "Entity — All" : v.charAt(0).toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              {ACTOR_ROLES.map(v => (
                <option key={v} value={v}>{v === "all" ? "Role — All" : v.charAt(0).toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-navy-700" />
            <div className="space-y-1">
              {filtered.length === 0 && <div className="text-center py-16 text-slate-500">No log entries found</div>}
              {filtered.map(log => {
                const Icon = ENTITY_ICON[log.entity_type] || Activity;
                const isSelected = selected?.log_id === log.log_id;
                return (
                  <div key={log.log_id}
                    className={clsx(
                      "relative pl-10 pr-4 py-3 rounded-xl cursor-pointer transition-all",
                      isSelected ? "bg-brand-500/10 border border-brand-500/30" : "hover:bg-navy-800/60 border border-transparent"
                    )}
                    onClick={() => setSelected(isSelected ? null : log)}
                  >
                    <div className={clsx(
                      "absolute left-3 top-4 w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      isSelected ? "border-brand-400 bg-brand-500/20" : "border-navy-600 bg-navy-800"
                    )}>
                      <div className={clsx("w-1.5 h-1.5 rounded-full", isSelected ? "bg-brand-400" : "bg-slate-600")} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1", ENTITY_COLOR[log.entity_type] || "")}>
                            <Icon className="w-3 h-3" />{log.entity_type}
                          </span>
                          <span className="text-sm font-medium text-slate-200">{log.action.replace(/\./g, " › ")}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-mono">{log.entity_id}</div>
                        {log.notes && <div className="text-xs text-slate-400 mt-1 line-clamp-1">{log.notes}</div>}
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          {log.actor && <span className={clsx("font-medium", ROLE_COLOR[log.actor_role||""] || "text-slate-400")}>{log.actor}</span>}
                          {log.actor_role && log.actor_role !== "system" && <span className="text-slate-600 capitalize">{log.actor_role}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatTime(log.created_at)}</span>
                        <Eye className="w-3.5 h-3.5 text-slate-600 hover:text-brand-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-xs text-slate-500 text-right pl-10">{filtered.length} of {logs.length} entries</div>
        </div>

        {selected && (
          <div className="w-full lg:w-96 shrink-0 space-y-4">
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-sm font-medium text-slate-300">Log detail</span>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-navy-700 text-slate-400 text-lg">&times;</button>
            </div>

            <div className="rounded-xl border border-navy-700 bg-navy-800 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-slate-500 mb-1">{selected.log_id}</div>
                  {(() => { const Icon = ENTITY_ICON[selected.entity_type] || Activity; return (
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 w-fit", ENTITY_COLOR[selected.entity_type] || "")}>
                      <Icon className="w-3 h-3" />{selected.entity_type}
                    </span>
                  ); })()}
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 lg:hidden">&times;</button>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Action</div>
                <div className="font-semibold text-slate-100 text-sm">{selected.action.replace(/\./g, " › ")}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Entity ID",  value: selected.entity_id },
                  { label: "Actor",      value: selected.actor || "—" },
                  { label: "Role",       value: selected.actor_role || "—" },
                  { label: "Timestamp",  value: selected.created_at ? new Date(selected.created_at).toLocaleString("en-AU") : "—" },
                  ...(selected.ip_address ? [{ label: "IP", value: selected.ip_address }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-slate-500 mb-0.5">{label}</div>
                    <div className="text-slate-200 truncate font-mono">{value}</div>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div>
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Notes</div>
                  <div className="text-sm text-slate-300 leading-relaxed bg-navy-900 rounded-lg p-3 border border-navy-700">{selected.notes}</div>
                </div>
              )}

              {(selected.before_state || selected.after_state) && (
                <div>
                  <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">State change</div>
                  <div className="space-y-2">
                    {selected.before_state && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                        <div className="text-xs text-red-400 font-medium mb-1">Before</div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{JSON.stringify(selected.before_state, null, 2)}</pre>
                      </div>
                    )}
                    {selected.after_state && (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                        <div className="text-xs text-emerald-400 font-medium mb-1">After</div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{JSON.stringify(selected.after_state, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-navy-900 border border-navy-700 p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 leading-relaxed">
                  This record is <span className="text-brand-400 font-medium">immutable</span>. Audit logs cannot be modified or deleted. Tamper-evident by design.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
