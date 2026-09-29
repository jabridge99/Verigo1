// Typed analytics & benchmarking client — thirty-fifth and final pilot
// for the shared lib/api/client.ts pattern. Covers
// app/analytics/benchmarking/page.tsx's single call site:
// GET /api/v1/benchmarks/dashboard. The route file also has
// /dashboard/history/{metric}, /dashboard/snapshots, the anonymised
// cross-org /industry* endpoints, /capture-snapshot(-all), and
// /compute-benchmarks (admin/scheduler) -- none called by this page,
// so scope matched what actually exists.
//
// Types mirror app/services/benchmark_service.py's
// get_org_benchmark_dashboard()'s literal return, confirmed live by
// calling the service function directly against a seeded SQLite DB
// (both the "fresh org, no data" and "published benchmark" cases) --
// not assumed from its docstring.

import { apiGet } from './client'

export type MetricRating =
  | 'top_quartile' | 'above_median' | 'below_median' | 'bottom_quartile'
  | 'informational' | 'no_benchmark'

/** One row of dashboard.metrics[]. `industry_p25`/`industry_p75`/
 * `industry_mean`/`industry_min`/`industry_max`/`industry_std_dev`/
 * `your_percentile`/`vs_median`/`vs_median_pct` are only present when a
 * published industry benchmark exists for this metric/period (rating
 * !== "no_benchmark") -- confirmed live these keys are entirely absent
 * (not even null) on a fresh org with no snapshot and no benchmark.
 * `your_value` is null when this org has no captured snapshot for the
 * metric. There is no `industry` field on the row itself (the old
 * local type and DEMO_METRICS both had one) -- it only exists once, at
 * the top level of the dashboard response, confirmed live. */
export interface MetricComparison {
  metric: string
  label: string
  unit: string
  your_value: number | null
  higher_is_better: boolean | null
  industry_median?: number | null
  industry_p25?: number | null
  industry_p75?: number | null
  industry_mean?: number | null
  industry_min?: number | null
  industry_max?: number | null
  industry_std_dev?: number | null
  your_percentile?: number | null
  // Raw signed difference (e.g. 16.4) -- the page doesn't display this
  // directly, since it lacks a sign and the metric's unit; it displays
  // vs_median_pct + unit instead, matching the sign-and-unit-formatted
  // look the page's own demo data always intended ("+16.4%").
  vs_median?: number | null
  vs_median_pct?: string | null
  rating: MetricRating
  org_count: number
}

export interface BenchmarkHeadline {
  metrics_in_top_quartile: number
  metrics_below_median: number
  metrics_needing_attention: number
  overall_rating: string
}

export interface AttentionItem {
  metric: string
  label: string
  your_value: number | null
  industry_median?: number | null
  rating: MetricRating
}

/** GET /benchmarks/dashboard */
export interface BenchmarkDashboard {
  org_id: string
  industry: string
  period_label?: string | null
  snapshot_captured_at?: string | null
  headline: BenchmarkHeadline
  metrics: MetricComparison[]
  attention_items: AttentionItem[]
}

/** GET /benchmarks/dashboard[?period_label=...] */
export function getBenchmarkDashboard(periodLabel?: string): Promise<BenchmarkDashboard> {
  const q = periodLabel ? `?period_label=${encodeURIComponent(periodLabel)}` : ''
  return apiGet(`/api/v1/benchmarks/dashboard${q}`)
}
