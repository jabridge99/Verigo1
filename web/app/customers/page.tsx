"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, RefreshCw, ChevronRight,
  UserPlus, Upload, Download,
} from "lucide-react";
import clsx from "clsx";
import { DEMO_CUSTOMERS, DEMO_PROFILES, type Customer } from "@/lib/demoCustomers";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export default function CustomerRiskDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CustomerRiskDashboard />
    </Suspense>
  );
}

function CustomerRiskDashboard() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState(searchParams.get("risk") || "all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Customers</h1>
            <p className="text-slate-500 text-sm mt-0.5">Risk profiles · KYC status · AML exposure per customer</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Link href="/onboarding?tab=manual" className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Add Customer
            </Link>
            <Link href="/onboarding?tab=import" className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Bulk Import
            </Link>
            <button
              onClick={() => {
                const csv = ["customer_id,full_name,email,risk_level,status", ...filtered.map(c => `${c.customer_id},${c.full_name},${c.email},${c.risk_level},${c.status}`)].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "customers-export.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary text-sm py-2 px-3 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Bulk Export
            </button>
            <button onClick={fetchCustomers} disabled={loading} className="btn-secondary text-sm py-2 px-3">
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
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

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
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
              <Link key={c.customer_id} href={`/customers/${c.customer_id}`}
                className="block rounded-xl border border-navy-700 bg-navy-800/30 hover:bg-navy-800/60 hover:border-brand-500/40 p-4 transition-all"
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
                  <div className="flex items-center gap-3">
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
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 text-right">{filtered.length} of {customers.length} customers</div>
      </div>
    </div>
  );
}
