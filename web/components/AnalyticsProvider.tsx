'use client'

import { useEffect, useState } from 'react'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { hasOptedOutOfAnalytics } from '@/lib/analyticsConsent'

// Strip anything that could carry a secret/identifying value (onboarding,
// email-verification, and QR verification links all embed single-use
// tokens in the path/query) before Vercel ever sees the URL.
const SENSITIVE_PATH_SEGMENTS = ['/onboarding/', '/verify/']

function scrub(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url)
  if (SENSITIVE_PATH_SEGMENTS.some(seg => url.pathname.includes(seg))) {
    const parts = url.pathname.split('/').filter(Boolean)
    url.pathname = '/' + parts.slice(0, 2).join('/') + '/[redacted]'
  }
  url.search = ''
  return { ...event, url: url.toString() }
}

export default function AnalyticsProvider() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const sync = () => setEnabled(!hasOptedOutOfAnalytics())
    sync()
    window.addEventListener('verigo-analytics-consent-changed', sync)
    return () => window.removeEventListener('verigo-analytics-consent-changed', sync)
  }, [])

  if (!enabled) return null

  return (
    <>
      <Analytics beforeSend={scrub} />
      <SpeedInsights />
    </>
  )
}
