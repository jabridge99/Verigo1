"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, TrendingUp, Users, FileText, AlertTriangle,
  Shield, CheckCircle, Clock, Activity,
} from "lucide-react";
import { getStoredUser, getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Demo data ──────────────────────────────────────────────────────────────────

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
  customers: { total: 1847, by_risk: { low: 920, medium: 614, high: 241, very_high: 72 } },
  transactions: { total: 28340, flagged: 413, flagged_pct: 1.5 },
  kyc: { total: 1847, by_status: { pending: 38, pending_review: 94, approved: 1512, rejected: 87, expired: 116 } },
  reports: { total: 342, by_status: { draft: 23, under_review: 41, approved: 67, submitted: 198, acknowledged: 11, rejected: 2 }, by_type: { ttr: 189, ifti_in: 54, ifti_out: 38, smr: 47, sar: 9, ecdd: 5, ctr: 0 } },
  alerts: { pending_kyc_reviews: 94, overdue_reports: 23, high_risk_customers: 313 },
};

const DEMO_TXN_TREND = makeTrend(30, 945, 300);
const DEMO_ONB_TREND = makeTrend(30, 18, 12);
const DEMO_RPT_TREND = makeTrend(90, 4, 6);

// ── Mini chart components ─────────────────────────────────────────────────────

interface Bar { date: string; count: number; volume?: number }

function BarChartSVG({ data, color = "#3b82f6", valueKey = "count", label = "" }: {
  data: Bar[]; color?: string; valueKey?: keyof Bar; label?: string;
}) {
  if (!data.length) return null;
  const vals = data.map(d => Number(d[valueKey]) || 0);
  const max = Math.max(...vals, 1);
  const w = 560; const h = 120; const barW = Math.max(2, (w / vals.length) - 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" style={{ minWidth: 280 }}>
        {vals.map((v, i) => {
          const bh = Math.max(2, (v / max) * h);
          const x = i * (w / vals.length);
          const y = h - bh;
          return (
            <g key={i}>
              <rect x={x + 1} y={y} width={barW} height={bh} fill={color} opacity={0.8} rx={2} />
              <title>{data[i].date}: {v.toLocaleString()}</title>
            </g>
          );
        })}
        {/* X-axis labels — first, middle, last */}
        {[0, Math.floor(vals.length / 2), vals.length - 1].map(i => (
          <text key={i} x={(i + 0.5) * (w / vals.length)} y={h + 18} textAnchor="middle"
            fontSize={10} fill="#64748b">
            {data[i]?.date?.slice(5) ?? ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

function DonutChart({ segments, colors }: { segments: { label: string; value: number }[]; colors: string[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="text-slate-500 text-sm text-center py-4">No data</div>;

  let angle = -90;
  const r = 60; const cx = 80; const cy = 80;
  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const sweep = pct * 360;
    const startRad = (angle * Math.PI) / 180;
    const endRad = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += sweep;
    return { d, color: colors[i % colors.length], label: seg.label, value: seg.value, pct };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.85}>
            <title>{p.label}: {p.value.toLocaleString()} ({(p.pct * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={32} fill="#0d1526" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fill="#fff" fontWeight={700}>{total.toLocaleString()}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#64748b">total</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-slate-400 truncate">{p.label}</span>
            <span className="ml-auto font-mono text-slate-300">{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{label}</span>
        <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(DEMO_SUMMARY);
  const [txnTrend, setTxnTrend] = useState(DEMO_TXN_TREND);
  const [onbTrend, setOnbTrend] = useState(DEMO_ONB_TREND);
  const [rptTrend, setRptTrend] = useState(DEMO_RPT_TREND);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  const user = typeof window !== "undefined" ? getStoredUser() : null;

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, [range]);

  const auth = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, tr, or_, rr] = await Promise.all([
        fetch(`${API}/api/v1/analytics/summary`, { headers: auth() }),
        fetch(`${API}/api/v1/analytics/transactions/volume-trend?days=${range}`, { headers: auth() }),
        fetch(`${API}/api/v1/analytics/customers/onboarding-trend?days=${range}`, { headers: auth() }),
        fetch(`${API}/api/v1/analytics/reports/submission-trend?days=${Math.max(range, 90)}`, { headers: auth() }),
      ]);
      if (!sr.ok) throw new Error("api");
      setSummary(await sr.json());
      setTxnTrend(await tr.json());
      setOnbTrend(await or_.json());
      setRptTrend(await rr.json());
    } catch {
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const s = summary;

  const riskSegments = [
    { label: "Low", value: s.customers.by_risk.low },
    { label: "Medium", value: s.customers.by_risk.medium },
    { label: "High", value: s.customers.by_risk.high },
    { label: "Very High", value: (s.customers.by_risk as any).very_high ?? 0 },
  ];
  const riskColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

  const kycSegments = Object.entries(s.kyc.by_status).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v as number }));
  const kycColors = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#94a3b8"];

  const reportTypeSegments = Object.entries(s.reports.by_type)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k.toUpperCase(), value: v as number }));
  const typeColors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#ef4444", "#f97316", "#22c55e", "#f59e0b"];

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><BarChart2 className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Compliance Analytics</h1>
              <p className="text-sm text-slate-400">Live metrics across your AML/CTF program</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === d ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
              >{d}d</button>
            ))}
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample analytics data
          </div>
        )}

        {/* Alert strip */}
        {(s.alerts.pending_kyc_reviews > 0 || s.alerts.overdue_reports > 0 || s.alerts.high_risk_customers > 0) && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {s.alerts.pending_kyc_reviews > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-amber-400">{s.alerts.pending_kyc_reviews} KYC reviews pending</div>
                  <div className="text-xs text-amber-400/70">Require MLRO sign-off</div>
                </div>
              </div>
            )}
            {s.alerts.overdue_reports > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-400">{s.alerts.overdue_reports} draft reports</div>
                  <div className="text-xs text-red-400/70">Not yet submitted to AUSTRAC</div>
                </div>
              </div>
            )}
            {s.alerts.high_risk_customers > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                <Shield className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-orange-400">{s.alerts.high_risk_customers} high-risk customers</div>
                  <div className="text-xs text-orange-400/70">May require ECDD</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPI label="Total Customers" value={s.customers.total} icon={Users} color="bg-blue-500/10 text-blue-400" sub={`${s.customers.by_risk.high ?? 0} high risk`} />
          <KPI label="Transactions" value={s.transactions.total} icon={Activity} color="bg-purple-500/10 text-purple-400" sub={`${s.transactions.flagged_pct}% flagged`} />
          <KPI label="Reports Filed" value={s.reports.total} icon={FileText} color="bg-green-500/10 text-green-400" sub={`${(s.reports.by_status as any).submitted ?? 0} submitted`} />
          <KPI label="KYC Approved" value={(s.kyc.by_status as any).approved ?? 0} icon={CheckCircle} color="bg-emerald-500/10 text-emerald-400" sub={`of ${s.kyc.total} total`} />
        </div>

        {/* Chart grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* Transaction volume trend */}
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

          {/* Customer risk donut */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm">Customer Risk Breakdown</h3>
            </div>
            <DonutChart segments={riskSegments} colors={riskColors} />
          </div>

          {/* Customer onboarding trend */}
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

          {/* KYC status donut */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-sm">KYC Status</h3>
            </div>
            <DonutChart segments={kycSegments} colors={kycColors} />
          </div>

          {/* Report submission trend */}
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

          {/* Report type donut */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Report Types</h3>
            </div>
            <DonutChart segments={reportTypeSegments} colors={typeColors} />
          </div>
        </div>

        {/* Flagged transactions stat */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
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
          {/* Flagged rate bar */}
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(s.transactions.flagged_pct * 10, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0%</span><span>Industry threshold: 3%</span><span>10%+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
