// Typed dashboard client — twenty-fifth pilot for the shared
// lib/api/client.ts pattern. Covers app/dashboard/page.tsx's 3
// /api/v1/dashboard/* call sites: global snapshot, compliance score,
// alert trend. The route file also has 5 industry-specific dashboards
// (/industry/remittance, /crypto, /legal, /accountants, /real-estate)
// and /trends/cases — none called by this page, so scope matched what
// actually exists.
//
// Types mirror app/api/routes/dashboard.py's global_dashboard()/
// compliance_score()/alert_trends() literal return shapes.

import { apiGet } from './client'

export type TrafficLight = 'green' | 'amber' | 'red'
export type Trend = 'up' | 'down' | 'stable'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface GlobalDashboard {
  generated_at: string
  org_risk: {
    risk_score: number
    risk_level: RiskLevel
    traffic_light: TrafficLight
  }
  alerts: {
    open: number
    critical: number
    smr_candidates: number
    by_severity: Record<RiskLevel, number>
    trend_30d: Trend
    new_30d: number
    traffic_light: TrafficLight
  }
  cases: {
    open: number
    escalated: number
    new_30d: number
    trend_30d: Trend
    traffic_light: TrafficLight
  }
  reports: {
    ifti_pending: number
    ifti_overdue: number
    ttr_pending: number
    ttr_overdue: number
    smr_pending: number
    total_pending: number
    total_overdue: number
    traffic_light: TrafficLight
  }
  customers: {
    total: number
    high_risk: number
    pep: number
    pending_review: number
    edd_required: number
    by_risk_level: Record<RiskLevel, number>
    traffic_light: TrafficLight
  }
  compliance_calendar: {
    overdue: number
    due_7d: number
    due_30d: number
    traffic_light: TrafficLight
  }
  smr_pipeline: {
    candidates: number
    pending_smr_reports: number
    traffic_light: TrafficLight
  }
  disclaimer: string
}

export interface ComplianceScore {
  compliance_score: number
  rating: 'excellent' | 'good' | 'needs_attention' | 'at_risk'
  traffic_light: TrafficLight
  components: {
    critical_alerts: number
    overdue_reports: number
    overdue_calendar_items: number
    edd_pending: number
    escalated_cases: number
  }
  disclaimer: string
}

export interface AlertTrendPoint {
  period_start: string
  period_end: string
  alerts: number
}

export interface AlertTrends {
  days: number
  data: AlertTrendPoint[]
}

/** GET /dashboard/global */
export function getGlobalDashboard(): Promise<GlobalDashboard> {
  return apiGet('/api/v1/dashboard/global')
}

/** GET /dashboard/compliance-score */
export function getComplianceScore(): Promise<ComplianceScore> {
  return apiGet('/api/v1/dashboard/compliance-score')
}

/** GET /dashboard/trends/alerts?days=... */
export function getAlertTrends(days?: number): Promise<AlertTrends> {
  return apiGet(`/api/v1/dashboard/trends/alerts${days !== undefined ? `?days=${days}` : ''}`)
}
