// Typed notifications client — twenty-sixth pilot for the shared
// lib/api/client.ts pattern. Covers app/notifications/page.tsx's 3
// /api/v1/notifications* call sites: list, mark one read, mark all
// read. The route file also has GET /summary, POST / (create,
// admin/mlro only), POST /run-deadline-check, and GET /types — none
// called by this page, so scope matched what actually exists.
//
// Types mirror app/schemas/notification.py's NotificationResponse.
// notif_type is left as a plain string rather than the ~25-value real
// NotificationType union: the page already renders unknown types via
// a generic fallback icon/color (most of the real enum, e.g. the
// training_*/portal_*/governance-deadline types, has no dedicated
// entry in the page's own TYPE_ICON/TYPE_COLOR maps), so a narrow
// union would just force casts without adding real safety here.

import { apiGet, apiPost } from './client'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Notification {
  id: number
  notif_id: string
  user_id?: string | null
  notif_type: string
  priority: NotificationPriority
  title: string
  body: string
  link?: string | null
  entity_type?: string | null
  entity_id?: string | null
  read: boolean
  emailed: boolean
  created_at?: string | null
  read_at?: string | null
}

export interface ListNotificationsFilters {
  unread_only?: boolean
  limit?: number
  offset?: number
}

/** GET /notifications */
export function listNotifications(filters: ListNotificationsFilters = {}): Promise<Notification[]> {
  const params = new URLSearchParams()
  if (filters.unread_only !== undefined) params.set('unread_only', String(filters.unread_only))
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))
  const qs = params.toString()
  return apiGet(`/api/v1/notifications${qs ? `?${qs}` : ''}`)
}

/** POST /notifications/{id}/read */
export function markNotificationRead(notifId: string): Promise<Notification> {
  return apiPost(`/api/v1/notifications/${notifId}/read`)
}

/** POST /notifications/read-all */
export function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  return apiPost('/api/v1/notifications/read-all')
}
