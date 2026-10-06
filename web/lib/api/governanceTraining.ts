// Typed governance/training-resource client — sixth pilot for the shared
// lib/api/client.ts pattern, and the first of governance's three
// sub-resources (training/policies/controls — each a separate pilot).
// Covers app/governance/training/page.tsx's /api/v1/governance/training/*
// call sites.
//
// Deliberately left as a plain URL (not a fetch function): the
// certificate export is a direct <a href> browser navigation, not a
// fetch+parse call site, and returns HTML (not JSON) — see
// certificateHtmlUrl().
//
// Types mirror app/api/routes/governance/training/_shared.py's
// _course_dict/_record_dict/_assignment_dict and each route's return
// shape, scoped to the fields this page actually renders (the full
// course/record dicts carry several more fields — learning_objectives,
// provider, external_url, etc — the catalogue/records views don't use).

import { apiGet, apiPost, API_BASE } from './client'

export interface Course {
  id: string
  course_code: string
  name: string
  training_type: string
  description?: string | null
  duration_minutes?: number | null
  has_assessment: boolean
  pass_mark?: number | null
  expiry_months?: number | null
  applicable_roles: string[]
  applicable_industries: string[]
  linked_control_ids: string[]
  linked_risk_factor_categories: string[]
  is_mandatory: boolean
  is_active: boolean
}

export interface ListCoursesResponse {
  courses: Course[]
  count: number
}

export type TrainingStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue' | 'expired' | 'exempt'

export interface TrainingRecord {
  id: string
  course_id: string
  user_id: string
  assigned_date: string
  due_date: string
  completion_date?: string | null
  expiry_date?: string | null
  score?: number | null
  passed?: boolean | null
  attempt_number: number
  status: TrainingStatus
  is_exempt: boolean
}

export interface ListRecordsResponse {
  records: TrainingRecord[]
  count: number
}

export interface TrainingDashboard {
  summary: {
    total: number
    non_exempt: number
    completed: number
    overdue: number
    in_progress: number
    assigned_not_started: number
    expired: number
    exempt: number
    expiring_within_30_days: number
  }
  metrics: {
    completion_pct: number
    overdue_count: number
    expiring_30d: number
    health_score: number
  }
  traffic_lights: {
    completion: string
    overdue: string
    expiry: string
    overall: string
  }
  by_course: {
    course_id: string
    course_name: string
    total: number
    completed: number
    overdue: number
    exempt: number
  }[]
  disclaimer: string
}

export interface ComplianceReportRow {
  training_type: string
  total_assigned: number
  completed: number
  overdue: number
  exempt: number
  completion_pct: number
}

export interface ComplianceReport {
  report_date: string
  overall: {
    total_assigned: number
    completed: number
    exempt: number
    overdue: number
    completion_pct: number
  }
  by_training_type: ComplianceReportRow[]
  mandatory_courses_100pct: boolean
  disclaimer: string
}

export interface SeedStandardResult {
  seeded: number
  already_existed: number
  message: string
}

export interface SeedIndustryPackResult {
  seeded: number
  packs_seeded: string[]
  message: string
}

export interface CompleteTrainingInput {
  completion_date: string
  score?: number
  certificate_number?: string
  certificate_document_id?: string
  notes?: string
}

export interface AssignmentInput {
  course_id: string
  user_ids: string[]
  roles: string[]
  due_date: string
  trigger: string
}

export interface Assignment {
  id: string
  course_id: string
  assigned_to_user_ids: string[]
  assigned_to_roles: string[]
  trigger: string
  assigned_date: string
  due_date: string
  total_assigned: number
  notes?: string | null
  is_active: boolean
  assigned_by: string
  created_at?: string | null
}

export interface CreateAssignmentResponse {
  assignment: Assignment
  records_created: number
  disclaimer: string
}

/** GET /governance/training/courses */
export function listCourses(): Promise<ListCoursesResponse> {
  return apiGet('/api/v1/governance/training/courses')
}

/** GET /governance/training/records */
export function listRecords(): Promise<ListRecordsResponse> {
  return apiGet('/api/v1/governance/training/records')
}

/** GET /governance/training/dashboard */
export function getTrainingDashboard(): Promise<TrainingDashboard> {
  return apiGet('/api/v1/governance/training/dashboard')
}

/** GET /governance/training/compliance-report */
export function getComplianceReport(): Promise<ComplianceReport> {
  return apiGet('/api/v1/governance/training/compliance-report')
}

/** POST /governance/training/courses/seed */
export function seedStandardCourses(): Promise<SeedStandardResult> {
  return apiPost('/api/v1/governance/training/courses/seed')
}

/** POST /governance/training/courses/seed-industry-pack — omit industry to seed every pack. */
export function seedIndustryPack(industry?: string | null): Promise<SeedIndustryPackResult> {
  const q = industry ? `?industry=${encodeURIComponent(industry)}` : ''
  return apiPost(`/api/v1/governance/training/courses/seed-industry-pack${q}`)
}

/** POST /governance/training/records/{id}/complete */
export function completeTraining(recordId: string, payload: CompleteTrainingInput): Promise<TrainingRecord> {
  return apiPost(`/api/v1/governance/training/records/${recordId}/complete`, payload)
}

/** POST /governance/training/records/{id}/retake */
export function retakeTraining(recordId: string): Promise<TrainingRecord> {
  return apiPost(`/api/v1/governance/training/records/${recordId}/retake`)
}

/** POST /governance/training/records/{id}/renew */
export function renewTraining(recordId: string, dueDate: string): Promise<TrainingRecord> {
  return apiPost(`/api/v1/governance/training/records/${recordId}/renew?due_date=${dueDate}`)
}

/** POST /governance/training/assignments — bulk-assign a course to users/roles. */
export function createAssignment(payload: AssignmentInput): Promise<CreateAssignmentResponse> {
  return apiPost('/api/v1/governance/training/assignments', payload)
}

/** GET /governance/training/records/{id}/certificate-html — print-ready HTML, not JSON. */
export function certificateHtmlUrl(recordId: string): string {
  return `${API_BASE}/api/v1/governance/training/records/${recordId}/certificate-html`
}
