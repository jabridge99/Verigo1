// Typed documents-resource client — fourteenth pilot for the shared
// lib/api/client.ts pattern. Covers app/documents/page.tsx's (the
// document vault) and components/Onboarding/DocumentUploadStep.tsx's
// (operator-assisted KYC upload) /api/v1/documents/* call sites —
// deliberately left out of the earlier `onboarding` pilot (C2 pass 23)
// as a genuinely separate resource, and now closed out on its own.
//
// Types mirror app/schemas/document.py's DocumentResponse/DocumentUpdate,
// and app/services/document_service.py's document_stats() dict.

import { apiFetch } from '@/lib/auth'
import { apiGet, apiPost, apiDelete, API_BASE } from './client'

export interface Doc {
  id: number
  doc_id: string
  filename: string
  mime_type?: string | null
  size_bytes: number
  category: string
  description?: string | null
  entity_type?: string | null
  entity_id?: string | null
  uploaded_by: string
  industry_id?: string | null
  status: string
  created_at?: string | null
}

export interface DocumentStats {
  total: number
  total_bytes: number
  by_category: Record<string, number>
}

export interface ListDocumentsParams {
  category?: string
  entityType?: string
  entityId?: string
  limit?: number
  offset?: number
}

export interface UploadDocumentInput {
  file: File
  category: string
  description?: string
  entityType?: string
  entityId?: string
}

/** GET /documents */
export function listDocuments(params: ListDocumentsParams = {}): Promise<Doc[]> {
  const q = new URLSearchParams()
  if (params.category) q.set('category', params.category)
  if (params.entityType) q.set('entity_type', params.entityType)
  if (params.entityId) q.set('entity_id', params.entityId)
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet(`/api/v1/documents${qs ? `?${qs}` : ''}`)
}

/** GET /documents/stats */
export function getDocumentStats(): Promise<DocumentStats> {
  return apiGet('/api/v1/documents/stats')
}

/** POST /documents (multipart) */
export function uploadDocument(input: UploadDocumentInput): Promise<Doc> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('category', input.category)
  if (input.description) form.append('description', input.description)
  if (input.entityType) form.append('entity_type', input.entityType)
  if (input.entityId) form.append('entity_id', input.entityId)
  return apiPost('/api/v1/documents', undefined, { body: form })
}

/**
 * GET /documents/{id}/download — returns the raw Response rather than
 * a parsed body, since a successful download is binary (the file's own
 * bytes, filename carried in Content-Disposition), not JSON. Callers
 * check `.ok` and read `.blob()` themselves, same as before migration.
 */
export function downloadDocument(docId: string): Promise<Response> {
  return apiFetch(`${API_BASE}/api/v1/documents/${docId}/download`, { credentials: 'include' })
}

/** POST /documents/{id}/archive */
export function archiveDocument(docId: string): Promise<Doc> {
  return apiPost(`/api/v1/documents/${docId}/archive`)
}

/** DELETE /documents/{id} */
export function deleteDocument(docId: string): Promise<void> {
  return apiDelete(`/api/v1/documents/${docId}`)
}
