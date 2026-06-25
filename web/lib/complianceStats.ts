// Shared org-wide compliance counters, used by the Dashboard KPI bar and the
// Compliance Journey tracker so both surfaces stay in sync with one source.
// Backed by the existing GET /api/v1/dashboard/global aggregate endpoint.

import { useEffect, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

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
  const [stats, setStats] = useState<ComplianceStats>(DEMO_COMPLIANCE_STATS)

  useEffect(() => {
    fetch(`${API}/api/v1/dashboard/global`, { credentials: "include" })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(d => {
        setStats({
          pending_kyc: (d.customers?.pending_review ?? 0) + (d.customers?.edd_required ?? 0),
          open_alerts: d.alerts?.open ?? 0,
          pending_reports: d.reports?.total_pending ?? 0,
          open_cases: d.cases?.open ?? 0,
        })
      })
      .catch(() => {})
  }, [])

  return stats
}
