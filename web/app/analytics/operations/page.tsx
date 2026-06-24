"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Activity, GraduationCap, FileCheck, Settings } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChartSVG, DonutChart, KPI, StatTile } from "../_components/charts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEMO = {
  onbTrend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(18 + (Math.random() - 0.5) * 12)),
  })),
  kyc: { total: 1847, by_status: { pass: 1512, fail: 87, refer: 94, not_performed: 154 } },
  txnTrend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    count: Math.max(0, Math.round(945 + (Math.random() - 0.5) * 300)),
  })),
  training: { total: 412, by_status: { assigned: 60, in_progress: 30, completed: 280, overdue: 22, exempted: 20 }, overdue: 22, due_within_30_days: 47, completion_pct: 87.4 },
  governance: { policy_reviews_due_30d: 6, policy_reviews_overdue: 2, control_tests_overdue: 4, controls_total: 58, open_findings_total: 11, open_findings_by_risk: { low: 3, medium: 5, high: 2, critical: 1 } },
};

export default function OperationsPage() {
  const router = useRouter();
  const [d, setD] = useState(DEMO);
  const [demo, setDemo] = useState(false);
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const load = useCallback(async () => {
    try {
      const [ob, kyc, tx, tr, gv] = await Promise.all([
        fetch(`${API}/api/v1/analytics/customers/onboarding-trend?days=30`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/kyc/status-breakdown`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/transactions/volume-trend?days=30`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/training/status-breakdown`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/governance/overview`, { credentials: "include" }),
      ]);
      if (!ob.ok) throw new Error("api");
      setD({
        onbTrend: await ob.json(),
        kyc: await kyc.json(),
        txnTrend: await tx.json(),
        training: await tr.json(),
        governance: await gv.json(),
      });
    } catch {
      setDemo(true);
    }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, []);

  const kycSegments = Object.entries(d.kyc.by_status)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number, href: `/onboarding?kyc_status=${k}` }));
  const kycColors = ["#22c55e", "#ef4444", "#f59e0b", "#94a3b8"];

  const trainingSegments = Object.entries(d.training.by_status)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number, href: `/governance/training?status=${k}` }));
  const trainingColors = ["#3b82f6", "#8b5cf6", "#22c55e", "#ef4444", "#94a3b8"];

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="text-sm text-slate-400">Onboarding throughput, KYC pipeline, training, and control operations</p>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample analytics data
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPI label="New Customers (30d)" value={d.onbTrend.reduce((a, b) => a + b.count, 0)} icon={Users} color="bg-blue-500/10 text-blue-400" href="/customers" />
          <KPI label="KYC Pending" value={(d.kyc.by_status as any).refer ?? 0} icon={FileCheck} color="bg-amber-500/10 text-amber-400" sub={`of ${d.kyc.total} total`} href="/onboarding?kyc_status=refer" />
          <KPI label="Training Completion" value={`${d.training.completion_pct}%`} icon={GraduationCap} color="bg-purple-500/10 text-purple-400" sub={`${d.training.overdue} overdue`} href="/governance/training" />
          <KPI label="Controls Overdue" value={d.governance.control_tests_overdue} icon={Settings} color="bg-slate-500/10 text-slate-300" sub={`of ${d.governance.controls_total} controls`} href="/governance/controls?status=overdue" />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Transaction Volume — 30d</h3>
          </div>
          <BarChartSVG data={d.txnTrend} color="#3b82f6" valueKey="count" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-sm">KYC Pipeline Status</h3>
            </div>
            <DonutChart segments={kycSegments} colors={kycColors} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm">Training Status</h3>
            </div>
            <DonutChart segments={trainingSegments} colors={trainingColors} />
          </div>
        </div>

        <Link href="/governance/risk-matrix?findings=open" className="block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-sm">Governance Findings by Risk</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(d.governance.open_findings_by_risk).map(([risk, count]) => (
              <StatTile key={risk} label={risk} value={count as number}
                color={risk === "critical" ? "text-red-400" : risk === "high" ? "text-orange-400" : risk === "medium" ? "text-amber-400" : "text-slate-300"} />
            ))}
          </div>
        </Link>
      </div>
    </div>
  );
}
