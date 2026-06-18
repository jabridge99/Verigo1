'use client'

// Vercel Web Analytics is cookieless — it does not set cookies or use
// localStorage to identify visitors, and aggregates anonymised page-view
// counts only (no IP storage, no cross-site tracking). That means under the
// Australian Privacy Act 1988 it does not require opt-in consent the way
// cookie-based tracking does, but APP 1 (openness) still means we disclose
// it and give visitors a way to turn it off — hence this lightweight
// opt-out toggle rather than a blocking consent gate.
const STORAGE_KEY = 'verigo_analytics_opt_out'

export function hasOptedOutOfAnalytics(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return
  if (optOut) {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event('verigo-analytics-consent-changed'))
}
