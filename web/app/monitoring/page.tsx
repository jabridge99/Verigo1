"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, ShieldAlert, Activity, BarChart3,
  RefreshCw, CheckCircle, XCircle, ArrowUpCircle, Search, Eye,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Alert {
  id: number; alert_id: string; transaction_id: number; customer_id?: number;
  industry_id?: string; alert_type: string; severity: string; status: string;
  description: string; rule_name?: string; action_taken?: string; notes?: string;
  assigned_to?: string; is_resolved: number; created_at?: string; resolved_at?: string;
}

interface Stats {
  total_alerts: number; open_alerts: number; by_severity: Record<string, number>;
  by_type: Record<string, number>; by_status: Record<string, number>;
  total_transactions: number; flagged_transactions: number;
}

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500",
};

const STATUS_COLORS: Record<string, string> = {
  open:         "bg-slate-500/20 text-slate-300",
  under_review: "bg-purple-500/20 text-purple-300",
  escalated:    "bg-red-500/20 text-red-300",
  dismissed:    "bg-slate-600/20 text-slate-500",
  resolved:     "bg-emerald-500/20 text-emerald-300",
  reported:     "bg-brand-500/20 text-brand-300",
};

const TYPE_LABELS: Record<string, string> = {
  large_transaction: "Large Transaction", structuring: "Structuring",
  rapid_movement: "Rapid Movement", high_risk_country: "High-Risk Country",
  unusual_pattern: "Unusual Pattern", sanctions_match: "Sanctions Match",
  velocity_breach: "Velocity Breach", cross_border: "Cross-Border (IFTI)",
  pep_transaction: "PEP Transaction", rule_triggered: "Custom Rule",
};

const DEMO_ALERTS: Alert[] = [
  { id: 1, alert_id: "ALT-DEMO0001", transaction_id: 1, customer_id: 1, alert_type: "sanctions_match", severity: "critical", status: "open", description: "Counterparty 'Petrov Trading LLC' matched on OFAC SDN sanctions watchlist.", is_resolved: 0, created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 2, alert_id: "ALT-DEMO0002", transaction_id: 2, customer_id: 2, alert_type: "large_transaction", severity: "high", status: "under_review", description: "Transaction AUD $45,000.00 meets or exceeds the CTR threshold of $10,000. AUSTRAC reporting may be required.", is_resolved: 0, assigned_to: "compliance@firm.com.au", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 3, alert_id: "ALT-DEMO0003", transaction_id: 3, customer_id: 3, alert_type: "structuring", severity: "high", status: "open", description: "4 transactions totalling AUD $38,200 detected near the CTR threshold within 24 hours — possible structuring.", is_resolved: 0, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 4, alert_id: "ALT-DEMO0004", transaction_id: 4, customer_id: 1, alert_type: "cross_border", severity: "high", status: "open", description: "International funds transfer instruction (IFTI) detected to/from IR. AUSTRAC IFTI report may be required.", is_resolved: 0, created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: 5, alert_id: "ALT-DEMO0005", transaction_id: 5, customer_id: 4, alert_type: "velocity_breach", severity: "medium", status: "open", description: "Velocity breach (24h): 18 transactions totalling AUD $72,400 exceed thresholds (15 txns / $50,000).", is_resolved: 0, created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 6, alert_id: "ALT-DEMO0006", transaction_id: 6, customer_id: 5, alert_type: "pep_transaction", severity: "high", status: "escalated", description: "Transaction of AUD $25,000.00 by a Politically Exposed Person (PEP). Enhanced due diligence required.", is_resolved: 0, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 7, alert_id: "ALT-DEMO0007", transaction_id: 7, customer_id: 2, alert_type: "high_risk_country", severity: "medium", status: "dismissed", description: "Counterparty country RU is on FATF/AUSTRAC high-risk jurisdiction list.", is_resolved: 1, created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 8, alert_id: "ALT-DEMO0008", transaction_id: 8, customer_id: 3, alert_type: "rule_triggered", severity: "medium", status: "resolved", description: "Custom rule triggered: 'Crypto withdrawal > $5,000'. Action: flag.", rule_name: "Crypto withdrawal > $5,000", is_resolved: 1, created_at: new Date(Date.now() - 259200000).toISOString() },
];

const DEMO_STATS: Stats = {
  total_alerts: 8, open_alerts: 5,
  by_severity: { critical: 1, high: 4, medium: 3, low: 0 },
  by_type: { large_transaction: 1, structuring: 1, cross_border: 1, sanctions_match: 1, velocity_breach: 1, pep_transaction: 1, high_risk_country: 1, rule_triggered: 1 },
  by_status: { open: 4, under_review: 1, escalated: 1, dismissed: 1, resolved: 1 },
  total_transactions: 124, flagged_transactions: 8,
};

type Tab = "queue" | "stats" | "simulate";

export default function MonitoringDashboard() {
  const [tab, setTab] = useState<Tab>("queue");
  const [alerts, setAlerts] = useState<Alert[]>(DEMO_ALERTS);
  const [stats, setStats] = useState<Stats>(DEMO_STATS);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`${API}/api/v1/transactions/alerts/queue?limit=200`, { credentials: "include" }),
        fetch(`${API}/api/v1/transactions/alerts/stats`, { credentials: "include" }),
      ]);
      if (aRes.ok) { const d = await aRes.json(); if (d.length) setAlerts(d); }
      if (sRes.ok) { const d = await sRes.json(); if (d.total_alerts) setStats(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doAction = async (action: "resolve" | "dismiss" | "escalate", alertId: string) => {
    const statusMap: Record<string, string> = { resolve: "resolved", dismiss: "dismissed", escalate: "escalated" };
    try {
      await fetch(`${API}/api/v1/transactions/alerts/${alertId}/${action}`, { method: "POST", credentials: "include" });
    } catch {}
    setAlerts(prev => prev.map(a =>
      a.alert_id === alertId ? { ...a, status: statusMap[action], is_resolved: action !== "escalate" ? 1 : 0 } : a
    ));
    setSelected(null);
    showToast("success", `Alert ${action}d`);
  };

  const filtered = alerts.filter(a => {
    const q = search.toLowerCase();
    return (!search || a.description.toLowerCase().includes(q) || a.alert_id.toLowerCase().includes(q))
      && (severityFilter === "all" || a.severity === severityFilter)
      && (statusFilter === "all" || a.status === statusFilter)
      && (typeFilter === "all" || a.alert_type === typeFilter);
  });

  const TABS = [
    { id: "queue" as Tab, label: "Alert Queue", icon: AlertTriangle },
    { id: "stats" as Tab, label: "Analytics", icon: BarChart3 },
    { id: "simulate" as Tab, label: "Test Monitor", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Transaction Monitoring</h1>
            <p className="text-slate-500 text-sm mt-0.5">AML alert queue — real-time surveillance</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.open_alerts > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-300 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {stats.open_alerts} open alerts
              </div>
            )}
            <button onClick={fetchData} className="btn-secondary text-sm py-2 px-4"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Critical", count: stats.by_severity.critical, color: "text-red-400" },
            { label: "High",     count: stats.by_severity.high,     color: "text-orange-400" },
            { label: "Medium",   count: stats.by_severity.medium,   color: "text-amber-400" },
            { label: "Open",     count: stats.open_alerts,          color: "text-slate-300" },
            { label: "Txns",     count: stats.total_transactions,   color: "text-brand-400" },
            { label: "Flagged",  count: stats.flagged_transactions,  color: "text-orange-400" },
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
              }`}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "queue" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search alerts…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {[
                { value: severityFilter, set: setSeverityFilter, options: ["all","critical","high","medium","low"], label: "Severity" },
                { value: statusFilter,  set: setStatusFilter,   options: ["all","open","under_review","escalated","dismissed","resolved","reported"], label: "Status" },
                { value: typeFilter,    set: setTypeFilter,     options: ["all",...Object.keys(TYPE_LABELS)], label: "Type" },
              ].map(({ value, set, options, label }) => (
                <select key={label} value={value} onChange={e => set(e.target.value)}
                  className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                  {options.map(o => <option key={o} value={o}>{o === "all" ? label + " — All" : TYPE_LABELS[o] || o.replace(/_/g, " ")}</option>)}
                </select>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-navy-700">
              <table className="w-full text-sm">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium w-6" />
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Alert</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Severity</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Time</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No alerts match your filters</td></tr>
                  ) : filtered.map(a => (
                    <tr key={a.alert_id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => setSelected(a)}>
                      <td className="px-4 py-3"><div className={`w-2 h-2 rounded-full ${SEV_DOT[a.severity] || "bg-slate-500"}`} /></td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-500 mb-0.5">{a.alert_id}</div>
                        <div className="text-slate-300 text-xs line-clamp-1 max-w-sm">{a.description}</div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-400">{TYPE_LABELS[a.alert_type] || a.alert_type}</span></td>
                      <td className="px-4 py-3"><span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", SEV_COLORS[a.severity])}>{a.severity}</span></td>
                      <td className="px-4 py-3"><span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[a.status] || "bg-slate-500/20 text-slate-400")}>{a.status.replace(/_/g, " ")}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{a.created_at ? new Date(a.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="px-4 py-3"><Eye className="w-4 h-4 text-slate-600 hover:text-brand-400 transition-colors" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {alerts.length} alerts</div>
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-100">Monitoring Analytics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Alerts",  value: stats.total_alerts,        color: "text-slate-200" },
                { label: "Open Alerts",   value: stats.open_alerts,          color: "text-amber-400" },
                { label: "Transactions",  value: stats.total_transactions,  color: "text-brand-400" },
                { label: "Flagged Txns",  value: stats.flagged_transactions, color: "text-orange-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-5 text-center">
                  <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-slate-200 mb-4">By Severity</h3>
                <div className="space-y-3">
                  {(["critical","high","medium","low"] as const).map(sev => {
                    const count = stats.by_severity[sev] || 0;
                    const max = Math.max(...Object.values(stats.by_severity), 1);
                    return (
                      <div key={sev} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${SEV_DOT[sev]}`} />
                        <span className="text-sm text-slate-400 capitalize w-16">{sev}</span>
                        <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${SEV_DOT[sev]}`} style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-200 w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-slate-200 mb-4">By Alert Type</h3>
                <div className="space-y-2">
                  {Object.entries(stats.by_type).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                    const max = Math.max(...Object.values(stats.by_type), 1);
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-36 truncate">{TYPE_LABELS[type] || type}</span>
                        <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-300 w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-slate-200 mb-4">By Status</h3>
                <div className="space-y-2">
                  {Object.entries(stats.by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm py-1 border-b border-navy-700 last:border-0">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs capitalize", STATUS_COLORS[status] || "bg-slate-500/20 text-slate-400")}>{status.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-slate-200">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-slate-200 mb-4">Detection Rate</h3>
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-brand-400">{stats.total_transactions > 0 ? `${Math.round((stats.flagged_transactions / stats.total_transactions) * 100)}%` : "0%"}</div>
                    <div className="text-slate-500 text-sm mt-2">of transactions flagged</div>
                    <div className="text-xs text-slate-600 mt-1">{stats.flagged_transactions} / {stats.total_transactions}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "simulate" && <SimulatePanel onAlert={(a) => { setAlerts(prev => [a, ...prev]); showToast("success", `Alert generated: ${a.alert_type}`); setTab("queue"); }} />}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.alert_id}</div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", SEV_COLORS[selected.severity])}>{selected.severity}</span>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
            </div>
            <div><div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Alert type</div><div className="font-medium text-slate-200">{TYPE_LABELS[selected.alert_type] || selected.alert_type}</div></div>
            <div><div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Description</div><div className="text-sm text-slate-300 leading-relaxed">{selected.description}</div></div>
            {selected.rule_name && <div><div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Rule</div><div className="text-sm text-slate-300">{selected.rule_name}</div></div>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-slate-500 mb-0.5">Status</div><span className={clsx("px-2 py-0.5 rounded-full text-xs capitalize", STATUS_COLORS[selected.status] || "")}>{selected.status.replace(/_/g, " ")}</span></div>
              {selected.assigned_to && <div><div className="text-xs text-slate-500 mb-0.5">Assigned to</div><div className="text-slate-300 text-xs">{selected.assigned_to}</div></div>}
              <div><div className="text-xs text-slate-500 mb-0.5">Created</div><div className="text-slate-400 text-xs">{selected.created_at ? new Date(selected.created_at).toLocaleString("en-AU") : "—"}</div></div>
            </div>
            {!selected.is_resolved && (
              <div className="border-t border-navy-700 pt-4 space-y-3">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Actions</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => doAction("resolve", selected.alert_id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors"><CheckCircle className="w-3.5 h-3.5" /> Resolve</button>
                  <button onClick={() => doAction("escalate", selected.alert_id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-300 text-xs font-medium hover:bg-orange-500/25 transition-colors"><ArrowUpCircle className="w-3.5 h-3.5" /> Escalate</button>
                  <button onClick={() => doAction("dismiss", selected.alert_id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-500/15 border border-slate-500/25 text-slate-400 text-xs font-medium hover:bg-slate-500/25 transition-colors"><XCircle className="w-3.5 h-3.5" /> Dismiss</button>
                </div>
                <textarea className="field-input min-h-[70px] resize-none text-xs" placeholder="Add notes…" value={actionNote} onChange={e => setActionNote(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${
          toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function SimulatePanel({ onAlert }: { onAlert: (a: Alert) => void }) {
  const [form, setForm] = useState({ amount: 12500, currency: "AUD", counterparty_country: "IR", transaction_type: "transfer", is_cross_border: true });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const simulate = async () => {
    setRunning(true); setResult(null);
    await new Promise(r => setTimeout(r, 800));
    const generatedAlerts: Alert[] = [];
    const now = new Date().toISOString();
    if (form.amount >= 10000) {
      generatedAlerts.push({ id: Date.now(), alert_id: `ALT-SIM${Math.random().toString(36).slice(2,8).toUpperCase()}`, transaction_id: 999, alert_type: "large_transaction", severity: "high", status: "open", description: `Transaction AUD $${form.amount.toLocaleString()} meets or exceeds CTR threshold of $10,000. AUSTRAC reporting may be required.`, is_resolved: 0, created_at: now });
    }
    if (form.is_cross_border) {
      const highRisk = ["IR","KP","RU","SY","AF","BY","MM"].includes(form.counterparty_country.toUpperCase());
      generatedAlerts.push({ id: Date.now()+1, alert_id: `ALT-SIM${Math.random().toString(36).slice(2,8).toUpperCase()}`, transaction_id: 999, alert_type: highRisk ? "high_risk_country" : "cross_border", severity: highRisk ? "high" : "medium", status: "open", description: `International funds transfer to ${form.counterparty_country}. ${highRisk ? "High-risk jurisdiction — FATF listed." : "AUSTRAC IFTI report may be required."}`, is_resolved: 0, created_at: now });
    }
    if (generatedAlerts.length === 0) { setResult("No alerts triggered — transaction appears normal."); }
    else { generatedAlerts.forEach(a => onAlert(a)); setResult(`${generatedAlerts.length} alert(s) triggered — see Alert Queue.`); }
    setRunning(false);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Test Monitoring Engine</h2>
        <p className="text-slate-500 text-sm">Simulate a transaction to see which alerts would fire without touching the database.</p>
      </div>
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><label className="text-xs font-medium text-slate-400">Amount (AUD)</label><input type="number" className="field-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-400">Transaction type</label><select className="field-input" value={form.transaction_type} onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option><option value="transfer">Transfer</option><option value="payment">Payment</option><option value="exchange">Exchange</option></select></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-400">Counterparty country (ISO-2)</label><input className="field-input" placeholder="e.g. IR, RU, AU" value={form.counterparty_country} onChange={e => setForm(f => ({ ...f, counterparty_country: e.target.value.toUpperCase() }))} /></div>
          <div className="space-y-1 flex flex-col justify-end"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-brand-500" checked={form.is_cross_border} onChange={e => setForm(f => ({ ...f, is_cross_border: e.target.checked }))} /><span className="text-sm text-slate-300">Cross-border (IFTI)</span></label></div>
        </div>
        <button onClick={simulate} disabled={running} className="btn-primary w-full justify-center">
          {running ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Activity className="w-4 h-4" />Run Simulation</>}
        </button>
        {result && <div className={`p-3 rounded-lg text-sm ${result.includes("No alerts") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-orange-500/10 border border-orange-500/20 text-orange-300"}`}>{result}</div>}
      </div>
      <div className="card text-sm space-y-2">
        <div className="font-medium text-slate-300 mb-3">Alert thresholds</div>
        {[
          { label: "CTR threshold", value: "≥ AUD $10,000" },
          { label: "Structuring", value: "3+ txns between $7k–$10k in 24h" },
          { label: "Velocity (24h)", value: "≥ 15 txns or AUD $50,000" },
          { label: "PEP transaction", value: "≥ AUD $5,000 by PEP customer" },
          { label: "High-risk country", value: "FATF/AUSTRAC listed jurisdictions" },
          { label: "Sanctions match", value: "Counterparty on OFAC/UN/DFAT list" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs py-1.5 border-b border-navy-700 last:border-0">
            <span className="text-slate-500">{label}</span><span className="text-slate-300">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
