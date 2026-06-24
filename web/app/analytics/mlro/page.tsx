"use client";

import { useState, useEffect, useCallback } from "react";
import { Briefcase, AlertTriangle, Shield, FileText, Clock } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DonutChart, KPI, StatTile } from "../_components/charts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEMO = {
  cases: { open_total: 19, by_status: { open: 6, under_investigation: 7, escalated: 3, decision: 3 }, by_severity: { low: 3, medium: 8, high: 6, critical: 2 }, overdue: 4, smr_candidates: 3 },
  flagged: { total: 28340, flagged: 413, flagged_pct: 1.5 },
  reports: { total: 342, by_status: { submitted: 198, acknowledged: 11, rejected: 2, draft: 23 }, by_type: { ttr: 189, ifti_in: 54, ifti_out: 38, smr: 47, sar: 9 } },
  pendingReviews: { overdue: 14, due_within_30_days: 38 },
};

export default function MLROAnalyticsPage() {
  const router = useRouter();
  const [d, setD] = useState(DEMO);
  const [demo, setDemo] = useState(false);
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const load = useCallback(async () => {
    try {
      const [cs, fl, rp, pr] = await Promise.all([
        fetch(`${API}/api/v1/analytics/cases/open-stats`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/transactions/flagged-stats`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/reports/stats`, { credentials: "include" }),
        fetch(`${API}/api/v1/analytics/customers/pending-reviews`, { credentials: "include" }),
      ]);
      if (!cs.ok) throw new Error("api");
      setD({ cases: await cs.json(), flagged: await fl.json(), reports: await rp.json(), pendingReviews: await pr.json() });
    } catch {
      setDemo(true);
    }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, []);

  const statusSegments = Object.entries(d.cases.by_status)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number, href: `/mlro?status=${k}` }));
  const statusColors = ["#ef4444", "#3b82f6", "#a855f7", "#f59e0b"];

  const reportTypeSegments = Object.entries(d.reports.by_type)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.toUpperCase(), value: v as number, href: `/reporting?type=${k}` }));
  const typeColors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#ef4444", "#f97316"];

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">MLRO Dashboard</h1>
          <p className="text-sm text-slate-400">Case management oversight, SMR pipeline, and reporting obligations</p>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample analytics data
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPI label="Open Cases" value={d.cases.open_total} icon={Briefcase} color="bg-pink-500/10 text-pink-400" sub={`${d.cases.overdue} overdue`} href="/mlro?status=open" />
          <KPI label="SMR Candidates" value={d.cases.smr_candidates} icon={AlertTriangle} color="bg-red-500/10 text-red-400" sub="awaiting determination" href="/mlro?smr_candidate=true" />
          <KPI label="Flagged Transactions" value={d.flagged.flagged} icon={Shield} color="bg-amber-500/10 text-amber-400" sub={`${d.flagged.flagged_pct}% of volume`} href="/monitoring?filter=flagged" />
          <KPI label="Reports Pending" value={(d.reports.by_status as any).draft ?? 0} icon={FileText} color="bg-blue-500/10 text-blue-400" sub={`of ${d.reports.total} total`} href="/reporting?status=draft" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-pink-400" />
              <h3 className="font-semibold text-sm">Cases by Status</h3>
            </div>
            <DonutChart segments={statusSegments} colors={statusColors} />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Report Types (SMR/TTR/IFTI)</h3>
            </div>
            <DonutChart segments={reportTypeSegments} colors={typeColors} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-sm">Cases by Severity</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(d.cases.by_severity).map(([sev, count]) => (
              <StatTile key={sev} label={sev} value={count as number}
                color={sev === "critical" ? "text-red-400" : sev === "high" ? "text-orange-400" : sev === "medium" ? "text-amber-400" : "text-slate-300"}
                href={`/mlro?severity=${sev}`} />
            ))}
          </div>
        </div>

        <Link href="/customers?review=overdue" className="block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Customer Periodic Reviews</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <StatTile label="Overdue" value={d.pendingReviews.overdue} color="text-red-400" />
            <StatTile label="Due within 30 days" value={d.pendingReviews.due_within_30_days} color="text-amber-400" />
          </div>
        </Link>
      </div>
    </div>
  );
}
