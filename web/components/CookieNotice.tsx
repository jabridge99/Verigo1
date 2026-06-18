'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { setAnalyticsOptOut } from '@/lib/analyticsConsent'

const SEEN_KEY = 'verigo_cookie_notice_seen'

export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(SEEN_KEY)) setVisible(true)
  }, [])

  const dismiss = (optOut: boolean) => {
    setAnalyticsOptOut(optOut)
    window.localStorage.setItem(SEEN_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1526] border-t border-slate-800 px-4 py-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-slate-300 flex-1">
          We use an essential, cookie-based session to keep you signed in, and
          privacy-friendly, cookieless analytics (Vercel Web Analytics — no
          tracking cookies, no personal data) to understand how Verigo is used.{' '}
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">
            Read our Privacy Policy
          </Link>
          .
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => dismiss(true)}
            className="text-sm text-slate-400 hover:text-slate-300 px-3 py-2 rounded-lg border border-slate-700"
          >
            Opt out of analytics
          </button>
          <button
            onClick={() => dismiss(false)}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
