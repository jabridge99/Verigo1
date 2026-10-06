// Typed IFTI-resource client — fifteenth pilot for the shared
// lib/api/client.ts pattern. Covers app/reporting/page.tsx's
// /api/v1/ifti/* call sites, deliberately left out of the `reports`
// pilot (C2 pass 22) as a genuinely separate resource — its own
// router/prefix (app/api/routes/ifti.py), not part of
// app/api/routes/reports/ — despite sharing the same page and the
// same generic review/approve/submit/acknowledge workflow shape as
// ttr/smr. Closes out that exclusion; app/reporting/page.tsx has no
// raw apiFetch()/API calls left in it after this pass.
//
// Type mirrors app/schemas/ifti.py's IFTIResponse, scoped to the
// fields app/reporting/page.tsx's mapReport() actually reads (not the
// full ~25-field AUSTRAC IFTI-DRA record). Unlike ttr/smr's workflow
// actions (a small ad-hoc {report_id, status} dict — see reports.ts),
// ifti's review/approve/submit/acknowledge endpoints really do return
// the full record (`response_model=IFTIResponse`, `return r`),
// confirmed against app/api/routes/ifti.py's literal return statements.

import { apiGet, apiPost } from './client'

export interface IFTIRecord {
  ifti_id: string
  direction: string
  status: string
  currency_code?: string | null
  total_amount?: number | null
  oc_full_name?: string | null
  bc_full_name?: string | null
  due_date?: string | null
  created_by?: string | null
  reviewed_by?: string | null
  approved_by?: string | null
  submission_reference?: string | null
  created_at?: string | null
  submitted_at?: string | null
  acknowledged_at?: string | null
}

/** GET /ifti/ */
export function listIftiRecords(): Promise<IFTIRecord[]> {
  return apiGet('/api/v1/ifti/')
}

/** POST /ifti/{id}/review */
export function reviewIftiRecord(iftiId: string): Promise<IFTIRecord> {
  return apiPost(`/api/v1/ifti/${iftiId}/review`)
}

/** POST /ifti/{id}/approve */
export function approveIftiRecord(iftiId: string): Promise<IFTIRecord> {
  return apiPost(`/api/v1/ifti/${iftiId}/approve`)
}

/** POST /ifti/{id}/submit */
export function submitIftiRecord(iftiId: string, submissionReference: string): Promise<IFTIRecord> {
  return apiPost(`/api/v1/ifti/${iftiId}/submit?submission_reference=${encodeURIComponent(submissionReference)}`)
}

/** POST /ifti/{id}/acknowledge */
export function acknowledgeIftiRecord(iftiId: string, acknowledgementRef: string): Promise<IFTIRecord> {
  return apiPost(`/api/v1/ifti/${iftiId}/acknowledge?acknowledgement_ref=${encodeURIComponent(acknowledgementRef)}`)
}
