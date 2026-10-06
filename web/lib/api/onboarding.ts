// Typed onboarding-resource client — thirteenth pilot for the shared
// lib/api/client.ts pattern. Covers app/onboarding/page.tsx's and
// components/Onboarding/BulkUpload.tsx's /api/v1/onboarding/* call
// sites — the ones that go through apiFetch() (Bearer token/CSRF,
// authenticated operator dashboard).
//
// Deliberately excludes app/onboarding/[token]/page.tsx and
// components/Onboarding/CustomerPortal.tsx, which hit
// /api/v1/onboarding/portal/{token}/* via plain, unauthenticated
// fetch() — a public, token-based flow for the applicant's own browser
// session, not the operator's. Genuinely different auth model, same
// discipline as excluding onboarding's public pages from the
// authenticated resource client throughout this migration.
//
// Types mirror app/schemas/onboarding.py's SessionSummary/SessionDetail/
// SessionCreate/BatchSummary/PipelineStats.

import { apiGet, apiPost } from './client'

export interface OnboardingSession {
  id: number
  session_id: string
  industry_id: string
  applicant_name: string
  applicant_email: string
  applicant_phone?: string | null
  customer_type: string
  status: string
  current_step: number
  total_steps: number
  completion_pct: number
  documents_uploaded: number
  reminders_sent: number
  sanctions_match?: boolean | null
  risk_level?: string | null
  risk_score?: number | null
  customer_id?: string | null
  kyc_id?: string | null
  source: string
  invite_sent_at?: string | null
  invite_opened_at?: string | null
  completed_at?: string | null
  created_at?: string | null
}

export interface OnboardingSessionDetail extends OnboardingSession {
  invite_token: string
  invite_expires_at?: string | null
  collected_data?: Record<string, unknown> | null
  batch_id?: string | null
  created_by?: string | null
}

export interface CreateSessionInput {
  applicant_name: string
  applicant_email: string
  applicant_phone?: string
  applicant_company?: string
  customer_type?: string
  industry_id: string
}

export interface PipelineStats {
  total: number
  invited: number
  opened: number
  in_progress: number
  completed: number
  rejected: number
  expired: number
  avg_completion_pct: number
  sanctions_matches: number
}

export interface BatchImportError {
  row?: number | null
  data?: unknown
  error: string
}

export interface BatchSummary {
  batch_id: string
  industry_id: string
  source: string
  file_name?: string | null
  total_rows: number
  success_rows: number
  error_rows: number
  errors?: BatchImportError[] | null
  created_at?: string | null
}

/** GET /onboarding/sessions */
export function listOnboardingSessions(industryId: string, limit?: number): Promise<OnboardingSession[]> {
  const q = limit != null ? `&limit=${limit}` : ''
  return apiGet(`/api/v1/onboarding/sessions?industry_id=${encodeURIComponent(industryId)}${q}`)
}

/** GET /onboarding/stats */
export function getOnboardingStats(industryId: string): Promise<PipelineStats> {
  return apiGet(`/api/v1/onboarding/stats?industry_id=${encodeURIComponent(industryId)}`)
}

/** POST /onboarding/sessions/{id}/remind */
export function sendOnboardingReminder(sessionId: string): Promise<unknown> {
  return apiPost(`/api/v1/onboarding/sessions/${sessionId}/remind`)
}

/** POST /onboarding/sessions/{id}/cancel */
export function cancelOnboardingSession(sessionId: string): Promise<OnboardingSessionDetail> {
  return apiPost(`/api/v1/onboarding/sessions/${sessionId}/cancel`)
}

/** POST /onboarding/sessions */
export function createOnboardingSession(payload: CreateSessionInput): Promise<OnboardingSessionDetail> {
  return apiPost('/api/v1/onboarding/sessions', payload)
}

/** POST /onboarding/import/csv or /onboarding/import/excel, by file extension. */
export function importOnboardingFile(file: File, industryId: string): Promise<BatchSummary> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const endpoint = ext === 'xlsx' || ext === 'xls' ? '/import/excel' : '/import/csv'
  const form = new FormData()
  form.append('industry_id', industryId)
  form.append('file', file)
  return apiPost(`/api/v1/onboarding${endpoint}`, undefined, { body: form })
}
