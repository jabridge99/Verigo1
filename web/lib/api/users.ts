// Typed users (RBAC/user-management) client — twenty-third pilot for the
// shared lib/api/client.ts pattern. Covers app/users/page.tsx's 4
// /api/v1/auth/users* call sites: list, create, suspend, activate.
//
// Types mirror app/schemas/user.py's UserResponse/UserCreate/UserUpdate.

import { apiGet, apiPost, apiPatch } from './client'

export type UserRole = 'admin' | 'mlro' | 'compliance' | 'analyst' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_mfa'

/** GET/POST /auth/users — mirrors UserResponse. The real identifier is
 * `id` (a string like "usr_xxxxx"), not a numeric id or a separate
 * user_id field -- app/models/user.py's User.id is the only PK. */
export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  org_id?: string | null
  industry_id?: string | null
  mfa_enabled: boolean
  email_verified: boolean
  oauth_provider?: string | null
  is_super_admin: boolean
  last_login_at?: string | null
  created_at?: string | null
}

export interface UserCreateInput {
  email: string
  full_name: string
  password: string
  role?: UserRole
  org_id?: string
  industry_id?: string
  tenant_id?: string
}

export interface UserUpdateInput {
  full_name?: string
  role?: UserRole
  status?: UserStatus
}

/** GET /auth/users */
export function listUsers(): Promise<AppUser[]> {
  return apiGet('/api/v1/auth/users')
}

/** POST /auth/users */
export function createUser(payload: UserCreateInput): Promise<AppUser> {
  return apiPost('/api/v1/auth/users', payload)
}

/** PATCH /auth/users/{id} */
export function updateUser(userId: string, payload: UserUpdateInput): Promise<AppUser> {
  return apiPatch(`/api/v1/auth/users/${userId}`, payload)
}

/** POST /auth/users/{id}/suspend */
export function suspendUser(userId: string): Promise<{ detail: string }> {
  return apiPost(`/api/v1/auth/users/${userId}/suspend`)
}

/** POST /auth/users/{id}/activate — the dedicated endpoint (records a
 * user_activated security event); prefer this over PATCH status=active,
 * which silently skips the audit-trail event since update_user_admin()
 * only logs when the role field changes, not status. */
export function activateUser(userId: string): Promise<{ detail: string }> {
  return apiPost(`/api/v1/auth/users/${userId}/activate`)
}
