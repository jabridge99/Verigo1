// Typed AUSTRAC examination-pack client — thirty-third pilot for the
// shared lib/api/client.ts pattern. Covers app/governance/examination-
// packs/page.tsx's 4 /api/v1/examination-packs* call sites: list,
// generate, deliver, archive. The page's export-html/export-csv links
// stay plain <a href> browser navigations (they return HTML/CSV, not
// JSON, and the page doesn't need to parse them), matching the
// documents.ts precedent. The route file also has GET /sections,
// GET /{id}, and GET /enums/values -- none called by this page, so
// scope matched what actually exists.
//
// Types mirror app/api/routes/examination_packs.py's _pack_to_dict()
// literal return shape (used by list/generate/deliver, but NOT
// archive, which returns its own small {archived, pack_id, pack_ref}
// confirmation dict -- the page already only does an optimistic local
// merge on archive rather than reading the response, so that was
// already correctly modelled).
//
// PackStatus deliberately omits the enum's 5th value, `draft`: read
// every ExaminationPack.status assignment site in
// examination_pack_service.py and confirmed no codepath ever sets it
// (generation goes straight to `generating`, then `ready`) -- a
// permanently dead enum member, not worth a styling entry for a state
// that can never occur.

import { apiGet, apiPost } from './client'

export type PackStatus = 'generating' | 'ready' | 'delivered' | 'archived'

export const EXAMINATION_SECTIONS = [
  'aml_program', 'customer_profile', 'transaction_monitoring', 'smr_register',
  'ifti_register', 'ttr_register', 'training_records', 'independent_reviews',
  'policy_register', 'control_testing', 'notification_history',
] as const
export type ExaminationSection = (typeof EXAMINATION_SECTIONS)[number]

/** GET /examination-packs/, POST /examination-packs/, POST .../deliver --
 * mirrors _pack_to_dict(include_snapshot=False). */
export interface ExaminationPack {
  id: string
  pack_ref: string
  org_id: string
  status: PackStatus
  period_start?: string | null
  period_end?: string | null
  sections: string[]
  examiner_name?: string | null
  examiner_agency: string
  examination_ref?: string | null
  summary_metrics?: Record<string, unknown> | null
  generation_errors?: string[] | null
  requested_by?: string | null
  generated_at?: string | null
  delivered_at?: string | null
  delivered_by?: string | null
  delivery_notes?: string | null
  is_confidential: boolean
  // A string like "1.0", not numeric -- confirmed live (the page's old
  // local type had `version: number`, but ExaminationPack.version is a
  // String(10) column with a "1.0"-style default). Never read by this
  // page, so a latent inaccuracy with no live impact, corrected here.
  version: string
  created_at?: string | null
}

export interface GeneratePackInput {
  period_start: string
  period_end: string
  // Loosely typed as string[] rather than ExaminationSection[] -- the
  // page builds this from freeform toggle-button state, and the backend
  // itself validates against EXAMINATION_SECTIONS (422 on anything
  // invalid), so the client doesn't need to duplicate that check.
  sections?: string[] | null
  examiner_name?: string | null
  examiner_agency?: string
  examination_ref?: string | null
}

/** POST /examination-packs/{id}/archive -- a distinct, smaller shape
 * from ExaminationPack; the page never reads this response body (it
 * does its own optimistic local status update instead), so this type
 * exists for accuracy rather than because anything consumes it. */
export interface ArchivePackResult {
  archived: boolean
  pack_id: string
  pack_ref: string
}

/** GET /examination-packs/[?status=...] */
export function listExaminationPacks(status?: PackStatus): Promise<ExaminationPack[]> {
  const q = status ? `?status=${status}` : ''
  return apiGet(`/api/v1/examination-packs/${q}`)
}

/** POST /examination-packs/ */
export function generateExaminationPack(payload: GeneratePackInput): Promise<ExaminationPack> {
  return apiPost('/api/v1/examination-packs/', payload)
}

/** POST /examination-packs/{id}/deliver */
export function deliverExaminationPack(packId: string, deliveryNotes?: string): Promise<ExaminationPack> {
  return apiPost(`/api/v1/examination-packs/${packId}/deliver`, { delivery_notes: deliveryNotes })
}

/** POST /examination-packs/{id}/archive */
export function archiveExaminationPack(packId: string): Promise<ArchivePackResult> {
  return apiPost(`/api/v1/examination-packs/${packId}/archive`)
}
