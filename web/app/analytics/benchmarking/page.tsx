"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChartHorizontal, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MetricRow {
  metric: string;
  label: string;
  unit: string;
  your_value: number;
  industry: string;
  industry_median: number;
  industry_p25: number;
  industry_p75: number;
  your_percentile: number;
  vs_median: string;
  rating: "top_quartile" | "above_median" | "below_median" | "bottom_quartile" | "informational" | "no_benchmark";
  higher_is_better: boolean;
  org_count: number;
}

const DEMO_METRICS: MetricRow[] = [
  { metric: "training_completion_pct", label: "Training Completion Rate", unit: "%", your_value: 87.4, industry: "remittance", industry_median: 71.0, industry_p25: 58.0, industry_p75: 82.0, your_percentile: 87, vs_median: "+16.4%", rating: "top_quartile", higher_is_better: true, org_count: 12 },
  { metric: "high_risk_customer_pct", label: "High-Risk Customer %", unit: "%", your_value: 17.0, industry: "remittance", industry_median: 13.5, industry_p25: 9.0, industry_p75: 19.0, your_percentile: 62, vs_median: "+3.5%", rating: "below_median", higher_is_better: false, org_count: 12 },
  { metric: "smr_rate_per_1k", label: "SMR Rate (per 1,000 txns)", unit: "/1k", your_value: 1.6, industry: "remittance", industry_median: 2.1, industry_p25: 1.2, industry_p75: 3.0, your_percentile: 34, vs_median: "-0.5", rating: "informational", higher_is_better: false, org_count: 12 },
  { metric: "open_alert_pct", label: "Open Alert %", unit: "%", your_value: 4.1, industry: "remittance", industry_median: 6.8, industry_p25: 3.5, industry_p75: 9.2, your_percentile: 78, vs_median: "-2.7%", rating: "top_quartile", higher_is_better: false, org_count: 12 },
  { metric: "control_effectiveness_pct", label: "Control Effectiveness", unit: "%", your_value: 91.2, industry: "remittance", industry_median: 84.0, industry_p25: 75.0, industry_p75: 93.0, your_percentile: 71, vs_median: "+7.2%", rating: "above_median", higher_is_better: true, org_count: 12 },
];

const RATING_STYLE: Record<string, string> = {
  top_quartile: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  above_median: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  below_median: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  bottom_quartile: "text-red-400 bg-red-500/10 border-red-500/30",
  informational: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  no_benchmark: "text-slate-500 bg-slate-500/5 border-slate-500/20",
};

const RATING_LABEL: Record<string, string> = {
  top_quartile: "Top quartile",
  above_median: "Above median",
  below_median: "Below median",
  bottom_quartile: "Bottom quartile",
  informational: "Informational",
  no_benchmark: "No benchmark yet",
};

export default function BenchmarkingPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricRow[]>(DEMO_METRICS);
  const [demo, setDemo] = useState(false);
  const [orgCount, setOrgCount] = useState(12);
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/benchmarks/dashboard`, { credentials: "include" });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      const rows: MetricRow[] = Array.isArray(data) ? data : data.metrics ?? [];
      if (!rows.length) throw new Error("empty");
      setMetrics(rows);
      setOrgCount(rows[0]?.org_count ?? 0);
    } catch {
      setDemo(true);
    }
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, []);

  return (
    <div className="px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><BarChartHorizontal className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Industry Benchmarking</h1>
            <p className="text-sm text-slate-400">Anonymous peer comparison — your org vs. {orgCount || "≥3"} industry peers</p>
          </div>
        </div>

        <div className="mb-6 flex items-start gap-2 px-4 py-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-sm text-slate-400">
          <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <span>Benchmarks are fully anonymised — no organisation names or identifiers are ever shared. Industry comparisons only publish once at least 3 organisations have contributed data for a period.</span>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample benchmark data
          </div>
        )}

        <div className="space-y-4">
          {metrics.map((m) => {
            const range = m.industry_p75 - m.industry_p25 || 1;
            const yourPos = Math.min(100, Math.max(0, ((m.your_value - m.industry_p25) / range) * 100));
            const medianPos = Math.min(100, Math.max(0, ((m.industry_median - m.industry_p25) / range) * 100));
            const TrendIcon = m.rating === "no_benchmark" ? Minus : m.higher_is_better === (m.your_value >= m.industry_median) ? TrendingUp : TrendingDown;

            return (
              <div key={m.metric} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className="text-xs text-slate-500">Industry: {m.industry} · {m.org_count} orgs reporting</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${RATING_STYLE[m.rating]}`}>
                    <TrendIcon className="w-3 h-3" />{RATING_LABEL[m.rating]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3 text-center">
                  <div>
                    <div className="text-xl font-bold text-white">{m.your_value}{m.unit}</div>
                    <div className="text-xs text-slate-500">Your value</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-300">{m.industry_median}{m.unit}</div>
                    <div className="text-xs text-slate-500">Industry median</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-indigo-400">{m.your_percentile}th</div>
                    <div className="text-xs text-slate-500">Your percentile</div>
                  </div>
                </div>

                {/* p25 — p75 range bar with your value + median markers */}
                <div className="relative h-3 rounded-full bg-white/10 mt-2">
                  <div className="absolute inset-y-0 bg-indigo-500/30 rounded-full" style={{ left: "0%", width: "100%" }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 border border-navy-900" style={{ left: `calc(${medianPos}% - 4px)` }} title="Industry median" />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-navy-900" style={{ left: `calc(${yourPos}% - 6px)` }} title="Your value" />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>p25: {m.industry_p25}{m.unit}</span>
                  <span className="text-slate-400">vs median: {m.vs_median}</span>
                  <span>p75: {m.industry_p75}{m.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
