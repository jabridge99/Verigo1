// Typed compliance-calendar client — twenty-seventh pilot for the
// shared lib/api/client.ts pattern. Covers app/governance/calendar/
// page.tsx's 3 /api/v1/compliance-calendar* call sites: list,
// dashboard, complete. The route file also has create, /upcoming,
// /{id} detail, bulk-schedule/process-reminders/escalate-overdue
// (all POST-only admin/compliance actions), and reminder endpoints —
// none called by this page, so scope matched what actually exists.
//
// Types mirror app/api/routes/compliance_calendar.py's _item_dict()
// literal return shape and app/models/compliance_calendar.py's
// CalendarItemType/CalendarItemStatus enums.

import { apiGet, apiPost } from './client'

export const ITEM_TYPES = [
  'customer_review', 'kyc_expiry', 'edd_review', 'policy_review', 'control_test',
  'training_expiry', 'ttr_deadline', 'ifti_deadline', 'smr_deadline',
  'aml_program_review', 'risk_assessment_review', 'independent_review',
  'high_risk_customer_review', 'austrac_obligation', 'board_reporting',
  'credential_expiry', 'other',
] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export type ItemStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled' | 'escalated'

/** GET /compliance-calendar[/{id}], POST .../complete — mirrors _item_dict(). */
export interface CalendarItem {
  id: string
  item_type: ItemType
  status: ItemStatus
  title: string
  description?: string | null
  due_date: string
  customer_id?: string | null
  report_id?: string | null
  assigned_to?: string | null
  is_recurring: boolean
  recurrence_months?: number | null
  next_due_date?: string | null
  completed_at?: string | null
  completed_by?: string | null
  is_overdue: boolean
  escalated_to?: string | null
  escalated_at?: string | null
  created_at: string
}

/** GET /compliance-calendar/dashboard */
export interface CalendarDashboard {
  open_items: number
  overdue: number
  due_within_30_days: number
  by_type: Record<string, number>
  pending_reminders: number
}

export interface ListCalendarItemsFilters {
  item_type?: ItemType
  status?: ItemStatus
  customer_id?: string
  is_overdue?: boolean
  page?: number
  page_size?: number
}

/** GET /compliance-calendar. Defaults page_size to the API's max (200) --
 * the bare endpoint defaults to page_size=25 server-side, which would
 * silently truncate any org with more than 25 open items with no
 * pagination UI on this page to recover the rest. */
export function listComplianceCalendarItems(filters: ListCalendarItemsFilters = {}): Promise<CalendarItem[]> {
  const params = new URLSearchParams()
  if (filters.item_type) params.set('item_type', filters.item_type)
  if (filters.status) params.set('status', filters.status)
  if (filters.customer_id) params.set('customer_id', filters.customer_id)
  if (filters.is_overdue !== undefined) params.set('is_overdue', String(filters.is_overdue))
  params.set('page', String(filters.page ?? 1))
  params.set('page_size', String(filters.page_size ?? 200))
  return apiGet(`/api/v1/compliance-calendar?${params.toString()}`)
}

/** GET /compliance-calendar/dashboard */
export function getCalendarDashboard(): Promise<CalendarDashboard> {
  return apiGet('/api/v1/compliance-calendar/dashboard')
}

/** POST /compliance-calendar/{id}/complete */
export function completeCalendarItem(itemId: string, completionNotes?: string): Promise<CalendarItem> {
  return apiPost(`/api/v1/compliance-calendar/${itemId}/complete`, { completion_notes: completionNotes })
}
