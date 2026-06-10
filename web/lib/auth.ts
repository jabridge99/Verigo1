'use client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'tvg_token'
const USER_KEY  = 'tvg_user'

export interface AuthUser {
  user_id: string
  email: string
  full_name: string
  role: 'admin' | 'mlro' | 'compliance' | 'analyst' | 'viewer'
  industry_id?: string
  access_token: string
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
  localStorage.setItem(TOKEN_KEY, user.access_token)
}

export function clearUser() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Login failed')
  }
  const data = await r.json()
  const user: AuthUser = { ...data, access_token: data.access_token }
  storeUser(user)
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Invalid magic link')
  }
  const data = await r.json()
  const user: AuthUser = { ...data, access_token: data.access_token }
  storeUser(user)
  return user
}

// Role hierarchy — higher index = more access
const ROLE_ORDER = ['viewer', 'analyst', 'compliance', 'mlro', 'admin'] as const

export function hasMinRole(userRole: string, minRole: string): boolean {
  const ui = ROLE_ORDER.indexOf(userRole as any)
  const mi = ROLE_ORDER.indexOf(minRole as any)
  return ui >= mi
}
