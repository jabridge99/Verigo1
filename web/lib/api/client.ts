'use client'

// Shared typed HTTP client for the Verigo API — built on top of apiFetch()
// (lib/auth.ts), which already handles the Bearer token and CSRF header.
// This layer adds the one thing every call site was independently
// reinventing: a single API_BASE constant, and a consistent
// parse-JSON-or-throw-with-.detail convention (see STRUCTURE_REVIEW.md's
// "no central frontend API client" item, and lib/signup.ts's own local
// asJson() for the pattern this replaces).
//
// Per-resource typed functions live in sibling files (e.g. customers.ts),
// each built on apiGet/apiPost/apiPatch/apiDelete below.

import { apiFetch } from '@/lib/auth'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseJsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new ApiError(err.detail ?? `Request failed (${r.status})`, r.status)
  }
  // Some endpoints (e.g. 204 No Content) have no body to parse.
  if (r.status === 204) return undefined as T
  return r.json()
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const r = await apiFetch(`${API_BASE}${path}`, { credentials: 'include', ...init })
  return parseJsonOrThrow<T>(r)
}

function jsonInit(method: string, body: unknown, init: RequestInit): RequestInit {
  const headers = new Headers(init.headers)
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return { ...init, method, headers, body: body !== undefined ? JSON.stringify(body) : init.body }
}

export function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, { method: 'GET', ...init })
}

export function apiPost<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  return request<T>(path, jsonInit('POST', body, init))
}

export function apiPatch<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  return request<T>(path, jsonInit('PATCH', body, init))
}

export function apiDelete<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, { method: 'DELETE', ...init })
}
