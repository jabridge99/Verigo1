'use client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const USER_KEY = 'tvg_user'
const TOKEN_KEY = 'tvg_token'

export interface AuthUser {
  user_id: string
  email: string
  full_name: string
  role: 'admin' | 'mlro' | 'compliance' | 'analyst' | 'viewer'
  industry_id?: string
  is_super_admin?: boolean
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function storeUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearUser() {
  localStorage.removeItem(USER_KEY)
  clearToken()
}

// ── Access token (P35) ────────────────────────────────────────────────────
//
// app/api/deps.py's get_current_user (used by 32 of 49 route files) reads
// the Authorization header only -- it does not accept the httpOnly session
// cookie login also sets. localStorage (not sessionStorage) so the token
// is available in a freshly opened tab, not just the one that logged in --
// sessionStorage is per-tab, and a fresh tab falling back to cookie-only
// auth would now be rejected by the CSRF double-submit check (see
// auth.py's _decode_current_user). No worse an exposure window than the
// cookie itself already has -- both carry the same
// ACCESS_TOKEN_EXPIRY_MINUTES max_age. See PARKING_LOT.md P35/CSRF.

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch { return null }
}

function storeToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}

/** Store both halves of a session in one call -- used by registerAccount()
 * (lib/signup.ts) alongside loginWithPassword()/verifyMagicLink() above,
 * so every entry point that receives a fresh access_token persists it the
 * same way. */
export function storeSession(user: AuthUser, token: string) {
  storeUser(user)
  storeToken(token)
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

/**
 * Drop-in replacement for fetch() against the Verigo API. Attaches the
 * stored access token as a Bearer header so authenticated requests work
 * regardless of which auth dependency the target route uses (see P35) --
 * callers don't need to know or care which of the 49 route files they're
 * hitting. Pass the same arguments as fetch(); credentials/headers/etc. in
 * `init` are preserved, with Authorization added only if not already set.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function getCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)tvg_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(init.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  // CSRF double-submit: harmless to send even when the request will
  // actually authenticate via the Authorization header above (the backend
  // only checks this for requests that resolve auth via the session
  // cookie) -- covers the fallback case where no token is stored yet.
  const method = (init.method ?? 'GET').toUpperCase()
  if (MUTATING_METHODS.has(method) && !headers.has('X-CSRF-Token')) {
    const csrf = getCsrfCookie()
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }
  return fetch(input, { ...init, headers })
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include', // receives the httpOnly session cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Login failed')
  }
  const data = await r.json()
  const user: AuthUser = data
  storeUser(user)
  if (data.access_token) storeToken(data.access_token)
  return user
}

export async function requestMagicLink(email: string): Promise<{ dev_token?: string }> {
  const r = await fetch(`${API}/api/v1/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new Error('Failed to send magic link')
  return r.json()
}

export async function verifyMagicLink(token: string): Promise<AuthUser> {
  const r = await fetch(`${API}/api/v1/auth/magic-link/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Invalid magic link')
  }
  const data = await r.json()
  const user: AuthUser = data
  storeUser(user)
  if (data.access_token) storeToken(data.access_token)
  return user
}

export async function requestEmailVerification(email: string): Promise<{ dev_token?: string }> {
  const r = await fetch(`${API}/api/v1/auth/email/verify/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new Error('Failed to send verification email')
  return r.json()
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/auth/email/verify/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Invalid verification link')
  }
}

export async function requestPasswordReset(email: string): Promise<{ dev_token?: string }> {
  const r = await fetch(`${API}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new Error('Failed to send password reset email')
  return r.json()
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const r = await fetch(`${API}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Failed to reset password')
  }
}

/** Revoke the session server-side (best-effort) and clear local auth state. */
export async function signOut(): Promise<void> {
  try {
    await apiFetch(`${API}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch { /* best-effort -- still clear local state below */ }
  clearUser()
}

/** Redirect the browser to start a social login flow. */
export function oauthLoginUrl(provider: 'google' | 'microsoft'): string {
  return `${API}/api/v1/auth/oauth/${provider}/login`
}

// Role hierarchy — higher index = more access
const ROLE_ORDER = ['viewer', 'analyst', 'compliance', 'mlro', 'admin'] as const

export function hasMinRole(userRole: string, minRole: string): boolean {
  const ui = ROLE_ORDER.indexOf(userRole as any)
  const mi = ROLE_ORDER.indexOf(minRole as any)
  return ui >= mi
}
