"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, AlertTriangle, Clock, GraduationCap, FileCheck,
  Search, Briefcase, Activity, FileText, TrendingUp,
} from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { BarChartSVG, DonutChart, KPI, StatTile } from "../_components/charts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEMO = {
  summary: {
    customers: { total: 1847, by_risk: { low: 920, medium: 614, high: 241, critical: 72 } },
    transactions: { total: 28340, flagged: 413, flagged_pct: 1.5 },
    reports: { total: 342, by_status: { submitted: 198, acknowledged: 11, rejected: 2, draft: 23 } },
  },
  onbTrend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(18 + (Math.random() - 0.5) * 12)),
  })),
  pendingReviews: { overdue: 14, due_within_30_days: 38 },
  training: { total: 412, overdue: 22, due_within_30_days: 47, completion_pct: 87.4 },
  governance: { policy_reviews_due_30d: 6, policy_reviews_overdue: 2, control_tests_overdue: 4, controls_total: 58, open_findings_total: 11, open_findings_by_risk: { low: 3, medium: 5, high: 2, critical: 1 } },
  cases: { open_total: 19, by_severity: { low: 3, medium: 8, high: 6, critical: 2 }, overdue: 4, smr_candidates: 3 },
};

export default function ExecutivePage() {
  const router = useRouter();
  const [d, setD] = useState(DEMO);
  const [demo, setDemo] = useState(false);
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const load = useCallback(async () => {
    try {
      const [sr, ob, pr, tr, gv, cs] = await Promise.all([
        fetch(`${API}/api/v1/analytics/summary`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/customers/onboarding-trend?days=30`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/customers/pending-reviews`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/training/status-breakdown`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/governance/overview`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/cases/open-stats`, { credentials: "include" }),
      ]);
      if (!sr.ok) throw new Error("api");
      setD({
        summary: await sr.json(),
        onbTrend: await ob.json(),
        pendingReviews: await pr.json(),
        training: await tr.json(),
        governance: await gv.json(),
        cases: await cs.json(),
      });
    } catch {
      setDemo(true);
    }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, []);

  const s = d.summary;
  const growth = d.onbTrend.reduce((a, b) => a + b.count, 0);

  const riskSegments = [
    { label: "Low", value: s.customers.by_risk.low, href: "/customers?risk=low" },
    { label: "Medium", value: s.customers.by_risk.medium, href: "/customers?risk=medium" },
    { label: "High", value: s.customers.by_risk.high, href: "/customers?risk=high" },
    { label: "Critical", value: (s.customers.by_risk as any).critical ?? 0, href: "/customers?risk=critical" },
  ];
  const riskColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

  const reportStatusSegments = Object.entries(s.reports.by_status)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number, href: `/reporting?status=${k}` }));
  const reportColors = ["#22c55e", "#3b82f6", "#ef4444", "#f59e0b"];

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Executive Dashboard</h1>
            <p className="text-sm text-slate-400">Organisation-wide compliance posture at a glance</p>
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample analytics data
          </div>
        )}

        {/* Top KPI row — the 10 required executive metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KPI label="Customer Growth (30d)" value={growth} icon={TrendingUp} color="bg-blue-500/10 text-blue-400" sub="new customers" href="/customers" />
          <KPI label="High Risk Customers" value={(s.customers.by_risk as any).high + ((s.customers.by_risk as any).critical ?? 0)} icon={Shield} color="bg-orange-500/10 text-orange-400" sub="high + critical" href="/customers?risk=high" />
          <KPI label="Pending Reviews" value={d.pendingReviews.overdue} icon={Search} color="bg-amber-500/10 text-amber-400" sub={`${d.pendingReviews.due_within_30_days} due in 30d`} href="/customers?review=overdue" />
          <KPI label="Training Due" value={d.training.overdue} icon={GraduationCap} color="bg-purple-500/10 text-purple-400" sub={`${d.training.completion_pct}% completion`} href="/governance/training?status=overdue" />
          <KPI label="Policy Reviews Due" value={d.governance.policy_reviews_overdue} icon={FileCheck} color="bg-rose-500/10 text-rose-400" sub={`${d.governance.policy_reviews_due_30d} due in 30d`} href="/governance/policies?review=overdue" />
          <KPI label="IR Findings (open)" value={d.governance.open_findings_total} icon={AlertTriangle} color="bg-red-500/10 text-red-400" sub={`${(d.governance.open_findings_by_risk as any)?.critical ?? 0} critical`} href="/governance/independent-review" />
          <KPI label="Open Cases" value={d.cases.open_total} icon={Briefcase} color="bg-pink-500/10 text-pink-400" sub={`${d.cases.overdue} overdue`} href="/mlro?status=open" />
          <KPI label="Transaction Volume" value={s.transactions.total} icon={Activity} color="bg-cyan-500/10 text-cyan-400" sub={`${s.transactions.flagged_pct}% flagged`} href="/monitoring" />
          <KPI label="Reports Filed" value={s.reports.total} icon={FileText} color="bg-green-500/10 text-green-400" sub={`${(s.reports.by_status as any).draft ?? 0} draft`} href="/reporting" />
          <KPI label="Controls Overdue" value={d.governance.control_tests_overdue} icon={Clock} color="bg-slate-500/10 text-slate-300" sub={`of ${d.governance.controls_total} controls`} href="/governance/controls?status=overdue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm">Risk Distribution</h3>
            </div>
            <DonutChart segments={riskSegments} colors={riskColors} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Reporting Status</h3>
            </div>
            <DonutChart segments={reportStatusSegments} colors={reportColors} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Customer Growth — 30d</h3>
          </div>
          <BarChartSVG data={d.onbTrend} color="#3b82f6" valueKey="count" />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-pink-400" />
            <h3 className="font-semibold text-sm">Open Cases by Severity</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(d.cases.by_severity).map(([sev, count]) => (
              <StatTile key={sev} label={sev} value={count as number}
                color={sev === "critical" ? "text-red-400" : sev === "high" ? "text-orange-400" : sev === "medium" ? "text-amber-400" : "text-slate-300"}
                href={`/mlro?severity=${sev}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
