// Typed analytics-resource client — second pilot for the shared
// lib/api/client.ts pattern (see customers.ts for the first). Covers
// exactly the analytics endpoints the frontend actually calls today
// (app/analytics/{executive,compliance,mlro,operations}/page.tsx) — not
// app/api/routes/analytics.py's full endpoint list (customer/risk-
// breakdown and audit/activity-trend aren't called from the frontend and
// are left out). Types mirror app/services/analytics_service.py's actual
// return dicts, which aren't backed by a Pydantic response_model on the
// route side — confirmed by reading the service functions directly.

import { apiGet } from './client'

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export interface TrendPoint {
  date: string
  count: number
}

export interface VolumeTrendPoint extends TrendPoint {
  volume: number
}

export interface FlaggedTransactionStats {
  total: number
  flagged: number
  flagged_pct: number
}

export interface KycStatusBreakdown {
  total: number
  by_status: Record<string, number>
}

export interface ReportStats {
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

export interface DashboardSummary {
  customers: { total: number; by_risk: Record<string, number> }
  transactions: FlaggedTransactionStats
  kyc: KycStatusBreakdown
  reports: ReportStats
  alerts: {
    pending_kyc_reviews: number
    overdue_reports: number
    high_risk_customers: number
  }
}

export interface PendingCustomerReviews {
  overdue: number
  due_within_30_days: number
}

export interface OpenCaseStats {
  open_total: number
  by_status: Record<string, number>
  by_severity: Record<string, number>
  overdue: number
  smr_candidates: number
}

export interface TrainingStatusBreakdown {
  total: number
  by_status: Record<string, number>
  overdue: number
  due_within_30_days: number
  completion_pct: number
}

export interface GovernanceOverview {
  policy_reviews_due_30d: number
  policy_reviews_overdue: number
  control_tests_overdue: number
  controls_total: number
  open_findings_total: number
  open_findings_by_risk: Record<string, number>
}

/** GET /analytics/summary */
export function getAnalyticsSummary(industryId?: string): Promise<DashboardSummary> {
  return apiGet(`/api/v1/analytics/summary${qs({ industry_id: industryId })}`)
}

/** GET /analytics/customers/onboarding-trend */
export function getCustomerOnboardingTrend(
  days = 30,
  industryId?: string
): Promise<TrendPoint[]> {
  return apiGet(
    `/api/v1/analytics/customers/onboarding-trend${qs({ days, industry_id: industryId })}`
  )
}

/** GET /analytics/customers/pending-reviews */
export function getPendingCustomerReviews(
  industryId?: string
): Promise<PendingCustomerReviews> {
  return apiGet(`/api/v1/analytics/customers/pending-reviews${qs({ industry_id: industryId })}`)
}

/** GET /analytics/training/status-breakdown */
export function getTrainingStatusBreakdown(
  industryId?: string
): Promise<TrainingStatusBreakdown> {
  return apiGet(`/api/v1/analytics/training/status-breakdown${qs({ industry_id: industryId })}`)
}

/** GET /analytics/governance/overview */
export function getGovernanceOverview(industryId?: string): Promise<GovernanceOverview> {
  return apiGet(`/api/v1/analytics/governance/overview${qs({ industry_id: industryId })}`)
}

/** GET /analytics/cases/open-stats */
export function getOpenCaseStats(industryId?: string): Promise<OpenCaseStats> {
  return apiGet(`/api/v1/analytics/cases/open-stats${qs({ industry_id: industryId })}`)
}

/** GET /analytics/transactions/volume-trend */
export function getTransactionVolumeTrend(
  days = 30,
  industryId?: string
): Promise<VolumeTrendPoint[]> {
  return apiGet(
    `/api/v1/analytics/transactions/volume-trend${qs({ days, industry_id: industryId })}`
  )
}

/** GET /analytics/reports/submission-trend */
export function getReportSubmissionTrend(
  days = 90,
  industryId?: string
): Promise<TrendPoint[]> {
  return apiGet(
    `/api/v1/analytics/reports/submission-trend${qs({ days, industry_id: industryId })}`
  )
}

/** GET /analytics/transactions/flagged-stats */
export function getFlaggedTransactionStats(
  industryId?: string
): Promise<FlaggedTransactionStats> {
  return apiGet(`/api/v1/analytics/transactions/flagged-stats${qs({ industry_id: industryId })}`)
}

/** GET /analytics/reports/stats */
export function getReportStats(industryId?: string): Promise<ReportStats> {
  return apiGet(`/api/v1/analytics/reports/stats${qs({ industry_id: industryId })}`)
}

/** GET /analytics/kyc/status-breakdown */
export function getKycStatusBreakdown(industryId?: string): Promise<KycStatusBreakdown> {
  return apiGet(`/api/v1/analytics/kyc/status-breakdown${qs({ industry_id: industryId })}`)
}
