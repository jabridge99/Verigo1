"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, TrendingUp, Users, FileText, AlertTriangle,
  Shield, CheckCircle, Clock, Activity,
} from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChartSVG, DonutChart, KPI } from "../_components/charts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function makeTrend(days: number, base: number, variance: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      count: Math.max(0, Math.round(base + (Math.random() - 0.5) * variance)),
      volume: Math.round((base * 12000 + Math.random() * 80000) * 100) / 100,
    };
  });
}

const DEMO_SUMMARY = {
  customers: { total: 1847, by_risk: { low: 920, medium: 614, high: 241, critical: 72 } },
  transactions: { total: 28340, flagged: 413, flagged_pct: 1.5 },
  kyc: { total: 1847, by_status: { pass: 1512, fail: 87, refer: 94, not_performed: 154 } },
  reports: { total: 342, by_status: { submitted: 198, acknowledged: 11, rejected: 2, draft: 23 }, by_type: { ttr: 189, ifti_in: 54, ifti_out: 38, smr: 47, sar: 9, ecdd: 5, ctr: 0 } },
  alerts: { pending_kyc_reviews: 94, overdue_reports: 23, high_risk_customers: 313 },
};

const DEMO_TXN_TREND = makeTrend(30, 945, 300);
const DEMO_ONB_TREND = makeTrend(30, 18, 12);
const DEMO_RPT_TREND = makeTrend(90, 4, 6);

export default function CompliancePage() {
  const router = useRouter();
  const [summary, setSummary] = useState(DEMO_SUMMARY);
  const [txnTrend, setTxnTrend] = useState(DEMO_TXN_TREND);
  const [onbTrend, setOnbTrend] = useState(DEMO_ONB_TREND);
  const [rptTrend, setRptTrend] = useState(DEMO_RPT_TREND);
  const [demo, setDemo] = useState(false);
  const [range, setRange] = useState(30);

  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const load = useCallback(async () => {
    try {
      const [sr, tr, or_, rr] = await Promise.all([
        fetch(`${API}/api/v1/analytics/summary`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/transactions/volume-trend?days=${range}`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/customers/onboarding-trend?days=${range}`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/reports/submission-trend?days=${Math.max(range, 90)}`, { credentials: "include" }),
      ]);
      if (!sr.ok) throw new Error("api");
      setSummary(await sr.json());
      setTxnTrend(await tr.json());
      setOnbTrend(await or_.json());
      setRptTrend(await rr.json());
    } catch {
      setDemo(true);
    }
  }, [range]);

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, [range]);

  const s = summary;

  const riskSegments = [
    { label: "Low", value: s.customers.by_risk.low, href: "/customers?risk=low" },
    { label: "Medium", value: s.customers.by_risk.medium, href: "/customers?risk=medium" },
    { label: "High", value: s.customers.by_risk.high, href: "/customers?risk=high" },
    { label: "Critical", value: (s.customers.by_risk as any).critical ?? 0, href: "/customers?risk=critical" },
  ];
  const riskColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

  const kycSegments = Object.entries(s.kyc.by_status).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number, href: `/onboarding?kyc_status=${k}` }));
  const kycColors = ["#22c55e", "#ef4444", "#f59e0b", "#94a3b8"];

  const reportTypeSegments = Object.entries(s.reports.by_type)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.toUpperCase(), value: v as number, href: `/reporting?type=${k}` }));
  const typeColors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#ef4444", "#f97316", "#22c55e", "#f59e0b"];

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><BarChart2 className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Compliance Dashboard</h1>
              <p className="text-sm text-slate-400">Live metrics across your AML/CTF program</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setRange(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === d ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample analytics data
          </div>
        )}

        {(s.alerts.pending_kyc_reviews > 0 || s.alerts.overdue_reports > 0 || s.alerts.high_risk_customers > 0) && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {s.alerts.pending_kyc_reviews > 0 && (
              <Link href="/onboarding?kyc_status=refer" className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 hover:bg-amber-500/15 transition-colors">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-amber-400">{s.alerts.pending_kyc_reviews} KYC reviews pending</div>
                  <div className="text-xs text-amber-400/70">Require MLRO sign-off</div>
                </div>
              </Link>
            )}
            {s.alerts.overdue_reports > 0 && (
              <Link href="/reporting?status=draft" className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 hover:bg-red-500/15 transition-colors">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-400">{s.alerts.overdue_reports} draft reports</div>
                  <div className="text-xs text-red-400/70">Not yet submitted to AUSTRAC</div>
                </div>
              </Link>
            )}
            {s.alerts.high_risk_customers > 0 && (
              <Link href="/customers?risk=high" className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 hover:bg-orange-500/15 transition-colors">
                <Shield className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-orange-400">{s.alerts.high_risk_customers} high-risk customers</div>
                  <div className="text-xs text-orange-400/70">May require ECDD</div>
                </div>
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPI label="Total Customers" value={s.customers.total} icon={Users} color="bg-blue-500/10 text-blue-400" sub={`${(s.customers.by_risk as any).high ?? 0} high risk`} href="/customers" />
          <KPI label="Transactions" value={s.transactions.total} icon={Activity} color="bg-purple-500/10 text-purple-400" sub={`${s.transactions.flagged_pct}% flagged`} href="/monitoring" />
          <KPI label="Reports Filed" value={s.reports.total} icon={FileText} color="bg-green-500/10 text-green-400" sub={`${(s.reports.by_status as any).submitted ?? 0} submitted`} href="/reporting" />
          <KPI label="KYC Pass Rate" value={(s.kyc.by_status as any).pass ?? 0} icon={CheckCircle} color="bg-emerald-500/10 text-emerald-400" sub={`of ${s.kyc.total} total`} href="/onboarding?kyc_status=pass" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h3 className="font-semibold text-sm">Transaction Volume — {range}d</h3>
            </div>
            <BarChartSVG data={txnTrend} color="#3b82f6" valueKey="count" />
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>Total: <strong className="text-white">{txnTrend.reduce((s, d) => s + d.count, 0).toLocaleString()}</strong></span>
              <span>Peak: <strong className="text-white">{Math.max(...txnTrend.map(d => d.count)).toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm">Customer Risk Breakdown</h3>
            </div>
            <DonutChart segments={riskSegments} colors={riskColors} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold text-sm">Customer Onboarding — {range}d</h3>
            </div>
            <BarChartSVG data={onbTrend} color="#22c55e" valueKey="count" />
            <div className="mt-2 text-xs text-slate-400">
              New customers: <strong className="text-white">{onbTrend.reduce((s, d) => s + d.count, 0).toLocaleString()}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-sm">KYC Status</h3>
            </div>
            <DonutChart segments={kycSegments} colors={kycColors} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-sm">Report Submissions — 90d</h3>
            </div>
            <BarChartSVG data={rptTrend} color="#ef4444" valueKey="count" />
            <div className="mt-2 text-xs text-slate-400">
              Total reports: <strong className="text-white">{rptTrend.reduce((s, d) => s + d.count, 0).toLocaleString()}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Report Types</h3>
            </div>
            <DonutChart segments={reportTypeSegments} colors={typeColors} />
          </div>
        </div>

        <Link href="/monitoring?filter=flagged" className="block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Transaction Monitoring</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{s.transactions.total.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Total transactions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{s.transactions.flagged.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Flagged suspicious</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{s.transactions.flagged_pct}%</div>
              <div className="text-xs text-slate-400">Flagged rate</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(s.transactions.flagged_pct * 10, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span><span>Industry threshold: 3%</span><span>10%+</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
