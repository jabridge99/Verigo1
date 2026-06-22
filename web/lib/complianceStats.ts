// Shared org-wide compliance counters, used by the Dashboard KPI bar and the
// Compliance Journey tracker so both surfaces stay in sync with one source.
// Demo data for now — swap for a live aggregated endpoint when one exists.

export interface ComplianceStats {
  pending_kyc: number
  open_alerts: number
  pending_reports: number
  open_cases: number
}

export const DEMO_COMPLIANCE_STATS: ComplianceStats = {
  pending_kyc: 12,
  open_alerts: 7,
  pending_reports: 3,
  open_cases: 4,
}

export function useComplianceStats(): ComplianceStats {
  return DEMO_COMPLIANCE_STATS
}
