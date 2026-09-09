"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, RefreshCw, Download, Eye,
  CheckCircle, AlertTriangle, FileText, Shield, User,
  Activity,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

// Entity type strings as actually written by the backend (both audit tables
// GET /audit/ merges — see app/api/routes/audit.py). Case-insensitive match
// since the two underlying tables use different casing conventions
// (snake_case in the legacy table, PascalCase in the newer one).
const ENTITY_COLOR: Record<string, string> = {
  ifti_report:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ttr_report:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  smr_report:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  alert:        "bg-red-500/20 text-red-300 border-red-500/30",
  case:         "bg-purple-500/20 text-purple-300 border-purple-500/30",
  customer:     "bg-teal-500/20 text-teal-300 border-teal-500/30",
  ecdd_record:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  document:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  aml_program:  "bg-slate-500/20 text-slate-300 border-slate-500/30",
  organisation: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  user:         "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  ifti_report:  FileText,
  ttr_report:   FileText,
  smr_report:   FileText,
  alert:        AlertTriangle,
  case:         ClipboardList,
  customer:     User,
  ecdd_record:  Shield,
  document:     CheckCircle,
  aml_program:  Activity,
  organisation: Shield,
  user:         User,
};

const ROLE_COLOR: Record<string, string> = {
  admin:     "text-red-400",
  mlro:      "text-purple-400",
  analyst:   "text-blue-400",
  system:    "text-slate-500",
  api:       "text-slate-400",
  compliance:"text-teal-400",
  viewer:    "text-slate-400",
};

const ENTITY_TYPES = [
  "all","ifti_report","ttr_report","smr_report","alert","case","customer",
  "ecdd_record","document","aml_program","organisation","user",
];
const ACTOR_ROLES  = ["all","admin","mlro","compliance","analyst","viewer","system"];

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/audit/?limit=200`, { credentials: "include" });
      if (res.ok) {
        const d: AuditLog[] = await res.json();
        // The two underlying audit tables this endpoint merges use different
        // casing conventions for entity_type (snake_case vs PascalCase) --
        // normalise once here rather than at every lookup/comparison site.
        setLogs(d.map(l => ({
          ...l,
          entity_type: (l.entity_type || "").toLowerCase(),
          actor_role: l.actor_role ? l.actor_role.toLowerCase() : l.actor_role,
        })));
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const exportCSV = async () => {
    try {
      const res = await fetch(`${API}/api/v1/audit/export/csv`, { credentials: "include" });
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
              {filtered.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  {loadError ? "Failed to load audit log — check your connection and retry." : "No log entries found"}
                </div>
              )}
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
