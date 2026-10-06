import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasOptedOutOfAnalytics, setAnalyticsOptOut } from './analyticsConsent'

describe('analyticsConsent', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('reports not opted out by default', () => {
    expect(hasOptedOutOfAnalytics()).toBe(false)
  })

  it('persists opt-out to localStorage and reports it back', () => {
    setAnalyticsOptOut(true)
    expect(hasOptedOutOfAnalytics()).toBe(true)
    expect(window.localStorage.getItem('verigo_analytics_opt_out')).toBe('1')
  })

  it('clears the opt-out key entirely when consent is given, not just set to a falsy value', () => {
    setAnalyticsOptOut(true)
    setAnalyticsOptOut(false)
    expect(hasOptedOutOfAnalytics()).toBe(false)
    expect(window.localStorage.getItem('verigo_analytics_opt_out')).toBeNull()
  })

  it('dispatches a change event so mounted components (e.g. AnalyticsProvider) react live', () => {
    const handler = vi.fn()
    window.addEventListener('verigo-analytics-consent-changed', handler)
    setAnalyticsOptOut(true)
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('verigo-analytics-consent-changed', handler)
  })
})
