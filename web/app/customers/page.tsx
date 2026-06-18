"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, AlertTriangle, ShieldCheck, FileText, TrendingUp,
  Search, RefreshCw, Eye, ChevronRight, Activity,
  XCircle, CheckCircle, Clock, BarChart2,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Customer {
  id: number;
  customer_id: string;
  full_name: string;
  email: string;
  nationality: string;
  country_of_residence: string;
  industry: string;
  occupation?: string;
  status: string;
  risk_level: string;
  risk_score: number;
  is_pep: number;
  created_at?: string;
}

interface CustomerProfile {
  customer: Customer;
  alert_count: number;
  open_alerts: number;
  report_count: number;
  open_reports: number;
  ecdd_count: number;
  transaction_count: number;
  total_transacted: number;
  last_transaction?: string;
  ecdd_recommendation?: string;
  kyc_status?: string;
}

const RISK_COLOR: Record<string, string> = {
  low:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const RISK_BAR: Record<string, string> = {
  low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-orange-500", critical: "bg-red-500",
};

const STATUS_COLOR: Record<string, string> = {
  pending:        "bg-slate-500/20 text-slate-300",
  kyc_in_progress:"bg-blue-500/20 text-blue-300",
  kyc_approved:   "bg-emerald-500/20 text-emerald-300",
  kyc_rejected:   "bg-red-500/20 text-red-300",
  active:         "bg-teal-500/20 text-teal-300",
  suspended:      "bg-red-500/20 text-red-300",
  closed:         "bg-slate-500/20 text-slate-400",
};

const REC_COLOR: Record<string, string> = {
  approve: "text-emerald-400", monitor: "text-amber-400", reject: "text-red-400",
};

const DEMO_CUSTOMERS: Customer[] = [
  { id: 1, customer_id: "CUST-DEMO0001", full_name: "Jane Smith", email: "jane.smith@email.com", nationality: "Australian", country_of_residence: "Australia", industry: "fintech", occupation: "Software Engineer", status: "active", risk_level: "low", risk_score: 12, is_pep: 0, created_at: new Date(Date.now() - 7776000000).toISOString() },
  { id: 2, customer_id: "CUST-DEMO0002", full_name: "Acme Pty Ltd", email: "compliance@acme.com.au", nationality: "Australian", country_of_residence: "Australia", industry: "banking", occupation: "Corporate Entity", status: "active", risk_level: "medium", risk_score: 48, is_pep: 0, created_at: new Date(Date.now() - 5184000000).toISOString() },
  { id: 3, customer_id: "CUST-DEMO0003", full_name: "Ivan Petrov", email: "ivan.petrov@email.ru", nationality: "Russian", country_of_residence: "Russia", industry: "cryptocurrency", occupation: "Trader", status: "suspended", risk_level: "critical", risk_score: 95, is_pep: 0, created_at: new Date(Date.now() - 2592000000).toISOString() },
  { id: 4, customer_id: "CUST-DEMO0004", full_name: "Li Wei", email: "li.wei@email.cn", nationality: "Chinese", country_of_residence: "China", industry: "real_estate", occupation: "Property Investor", status: "kyc_approved", risk_level: "high", risk_score: 72, is_pep: 1, created_at: new Date(Date.now() - 1296000000).toISOString() },
  { id: 5, customer_id: "CUST-DEMO0005", full_name: "Wei Zhang", email: "wei.zhang@email.com", nationality: "Australian", country_of_residence: "Australia", industry: "real_estate", occupation: "Real Estate Agent", status: "active", risk_level: "medium", risk_score: 35, is_pep: 0, created_at: new Date(Date.now() - 864000000).toISOString() },
];

const DEMO_PROFILES: Record<string, Partial<CustomerProfile>> = {
  "CUST-DEMO0001": { alert_count: 0, open_alerts: 0, report_count: 1, open_reports: 0, ecdd_count: 1, transaction_count: 42, total_transacted: 87400, ecdd_recommendation: "approve", kyc_status: "approved" },
  "CUST-DEMO0002": { alert_count: 3, open_alerts: 1, report_count: 2, open_reports: 1, ecdd_count: 0, transaction_count: 128, total_transacted: 412000, kyc_status: "approved" },
  "CUST-DEMO0003": { alert_count: 5, open_alerts: 3, report_count: 2, open_reports: 2, ecdd_count: 1, transaction_count: 17, total_transacted: 85000, ecdd_recommendation: "reject", kyc_status: "pending" },
  "CUST-DEMO0004": { alert_count: 4, open_alerts: 2, report_count: 1, open_reports: 0, ecdd_count: 2, transaction_count: 8, total_transacted: 320000, ecdd_recommendation: "monitor", kyc_status: "approved" },
  "CUST-DEMO0005": { alert_count: 1, open_alerts: 0, report_count: 1, open_reports: 0, ecdd_count: 0, transaction_count: 63, total_transacted: 148000, kyc_status: "approved" },
};

export default function CustomerRiskDashboard() {
  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customers/?limit=100`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); if (d.length) setCustomers(d); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (!search || c.full_name.toLowerCase().includes(q) || c.customer_id.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      && (riskFilter === "all" || c.risk_level === riskFilter)
      && (statusFilter === "all" || c.status === statusFilter);
  });

  const stats = {
    total: customers.length,
    critical: customers.filter(c => c.risk_level === "critical").length,
    high: customers.filter(c => c.risk_level === "high").length,
    pep: customers.filter(c => c.is_pep).length,
    suspended: customers.filter(c => c.status === "suspended").length,
  };

  const profile = selected
    ? { customer: selected, ...(DEMO_PROFILES[selected.customer_id] || { alert_count: 0, open_alerts: 0, report_count: 0, open_reports: 0, ecdd_count: 0, transaction_count: 0, total_transacted: 0 }) } as CustomerProfile
    : null;

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Customer Risk Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Risk profiles · KYC status · AML exposure per customer</p>
          </div>
          <button onClick={fetchCustomers} disabled={loading} className="btn-secondary text-sm py-2 px-4 self-start">
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total customers", count: stats.total,    color: "text-slate-200" },
            { label: "Critical risk",   count: stats.critical, color: "text-red-400" },
            { label: "High risk",       count: stats.high,     color: "text-orange-400" },
            { label: "PEP",             count: stats.pep,      color: "text-amber-400" },
            { label: "Suspended",       count: stats.suspended,color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className={`font-bold text-sm ${color}`}>{count}</span>
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
                placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              {["all","low","medium","high","critical"].map(v => (
                <option key={v} value={v}>{v === "all" ? "Risk — All" : v.charAt(0).toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              {["all","active","pending","kyc_approved","kyc_rejected","suspended","closed"].map(v => (
                <option key={v} value={v}>{v === "all" ? "Status — All" : v.replace(/_/g," ")}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-16 text-slate-500">No customers found</div>}
            {filtered.map(c => {
              const p = DEMO_PROFILES[c.customer_id] || {};
              return (
                <div key={c.customer_id}
                  className={clsx(
                    "rounded-xl border p-4 cursor-pointer transition-all hover:border-brand-500/40",
                    selected?.customer_id === c.customer_id
                      ? "border-brand-500/50 bg-brand-500/5"
                      : "border-navy-700 bg-navy-800/30 hover:bg-navy-800/60"
                  )}
                  onClick={() => setSelected(c)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{c.full_name}</span>
                        {c.is_pep ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[c.status] || "")}>
                          {c.status.replace(/_/g," ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">{c.customer_id} · {c.email}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>{c.industry.replace(/_/g," ")}</span>
                        <span>{c.country_of_residence}</span>
                        {(p.open_alerts ?? 0) > 0 && <span className="text-red-400 font-medium">{p.open_alerts} open alert{(p.open_alerts ?? 0) > 1 ? "s" : ""}</span>}
                        {(p.open_reports ?? 0) > 0 && <span className="text-amber-400 font-medium">{p.open_reports} open report{(p.open_reports ?? 0) > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", RISK_COLOR[c.risk_level] || "")}>
                        {c.risk_level}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1.5 rounded-full bg-navy-700">
                          <div className={`h-full rounded-full ${RISK_BAR[c.risk_level]}`} style={{ width: `${c.risk_score}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-6 text-right">{c.risk_score.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 text-right">{filtered.length} of {customers.length} customers</div>
        </div>

        {selected && profile && (
          <div className="w-full lg:w-96 xl:w-[420px] shrink-0 space-y-4">
            <div className="flex items-center justify-between lg:hidden">
              <span className="text-sm font-medium text-slate-300">Customer profile</span>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-navy-700 text-slate-400">&times;</button>
            </div>

            <div className="rounded-xl border border-navy-700 bg-navy-800 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-100 text-base">{selected.full_name}</div>
                  <div className="font-mono text-xs text-slate-500 mt-0.5">{selected.customer_id}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", RISK_COLOR[selected.risk_level] || "")}>
                    {selected.risk_level} risk
                  </span>
                  {selected.is_pep ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Risk score</span>
                  <span className={clsx("font-bold",
                    selected.risk_score >= 75 ? "text-red-400" : selected.risk_score >= 50 ? "text-amber-400" : "text-emerald-400"
                  )}>{selected.risk_score.toFixed(0)} / 100</span>
                </div>
                <div className="h-2 rounded-full bg-navy-700">
                  <div className={`h-full rounded-full transition-all ${RISK_BAR[selected.risk_level]}`}
                    style={{ width: `${selected.risk_score}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Status",      value: <span className="capitalize">{selected.status.replace(/_/g," ")}</span> },
                  { label: "KYC",         value: <span className="capitalize">{profile.kyc_status || "—"}</span> },
                  { label: "Industry",    value: selected.industry.replace(/_/g," ") },
                  { label: "Occupation",  value: selected.occupation || "—" },
                  { label: "Nationality", value: selected.nationality },
                  { label: "Residence",   value: selected.country_of_residence },
                  { label: "Email",       value: selected.email },
                  { label: "Onboarded",   value: selected.created_at ? new Date(selected.created_at).toLocaleDateString("en-AU") : "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-slate-500 mb-0.5">{label}</div>
                    <div className="text-slate-200 text-xs truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">AML Exposure</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: AlertTriangle, label: "Total alerts",  value: profile.alert_count,       sub: `${profile.open_alerts} open`,          urgent: (profile.open_alerts ?? 0) > 0 },
                  { icon: FileText,      label: "Reports",       value: profile.report_count,      sub: `${profile.open_reports} open`,         urgent: (profile.open_reports ?? 0) > 0 },
                  { icon: ShieldCheck,   label: "ECDD reviews",  value: profile.ecdd_count,        sub: profile.ecdd_recommendation ? `→ ${profile.ecdd_recommendation}` : "none", urgent: profile.ecdd_recommendation === "reject" },
                  { icon: Activity,      label: "Transactions",  value: profile.transaction_count, sub: profile.total_transacted ? `AUD $${(profile.total_transacted / 1000).toFixed(0)}k total` : "—", urgent: false },
                ].map(({ icon: Icon, label, value, sub, urgent }) => (
                  <div key={label} className={`rounded-lg p-3 border ${urgent ? "bg-red-500/10 border-red-500/20" : "bg-navy-900 border-navy-700"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${urgent ? "text-red-400" : "text-slate-500"}`} />
                      <span className="text-xs text-slate-500">{label}</span>
                    </div>
                    <div className={`text-xl font-bold ${urgent ? "text-red-300" : "text-slate-100"}`}>{value}</div>
                    <div className={`text-xs mt-0.5 ${urgent && profile.ecdd_recommendation ? REC_COLOR[profile.ecdd_recommendation!] || "text-slate-500" : urgent ? "text-red-400" : "text-slate-500"}`}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Risk Factors</div>
              <div className="space-y-2">
                {[
                  { label: "PEP status",         active: !!selected.is_pep,                              note: selected.is_pep ? "Politically exposed person" : "Not a PEP" },
                  { label: "High-risk country",  active: ["Russia","Iran","North Korea","Syria"].includes(selected.country_of_residence), note: selected.country_of_residence },
                  { label: "High-risk industry", active: ["cryptocurrency","real_estate"].includes(selected.industry), note: selected.industry.replace(/_/g," ") },
                  { label: "Open alerts",        active: (profile.open_alerts ?? 0) > 0,                note: `${profile.open_alerts ?? 0} unresolved` },
                  { label: "Open reports",       active: (profile.open_reports ?? 0) > 0,               note: `${profile.open_reports ?? 0} pending` },
                  { label: "ECDD recommendation",active: ["monitor","reject"].includes(profile.ecdd_recommendation || ""), note: profile.ecdd_recommendation || "no ECDD" },
                ].map(({ label, active, note }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-red-400" : "bg-emerald-500"}`} />
                      <span className={active ? "text-slate-200" : "text-slate-500"}>{label}</span>
                    </div>
                    <span className={active ? "text-slate-300" : "text-slate-600"}>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Quick Links</div>
              <div className="space-y-1">
                {[
                  { label: "View alerts",  href: `/monitoring?customer=${selected.customer_id}`,  icon: AlertTriangle },
                  { label: "View reports", href: `/reporting?customer=${selected.customer_id}`,   icon: FileText },
                  { label: "View ECDD",    href: `/ecdd?customer=${selected.customer_id}`,        icon: ShieldCheck },
                ].map(({ label, href, icon: Icon }) => (
                  <a key={label} href={href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-navy-700 transition-colors text-sm text-slate-300 hover:text-white">
                    <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-slate-500" />{label}</div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
